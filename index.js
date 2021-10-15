// Partner Engineering Escalation Bot
// Steven Luzynski <sluzynsk@cisco.com>
// October, 2021

var framework = require("webex-node-bot-framework");
var webhook = require("webex-node-bot-framework/webhook");
var express = require("express");
var bodyParser = require("body-parser");
var app = express();
app.use(bodyParser.json());
app.use(express.static("images"));
const config = require("./config.json");
const new_card = require("./new_card.json");

// init framework
var framework = new framework(config);
framework.start();
console.log("Starting framework, please wait...");

framework.on("initialized", function () {
  console.log("framework is all fired up! [Press CTRL-C to quit]");
});

// A spawn event is generated when the framework finds a space with your bot in it
// If actorId is set, it means that user has just added your bot to a new space
// If not, the framework has discovered your bot in an existing space
framework.on("spawn", (bot, id, actorId) => {
  if (!actorId) {
    // don't say anything here or your bot's spaces will get
    // spammed every time your server is restarted
    console.log(
      `While starting up, the framework found our bot in a space called: ${bot.room.title}`
    );
  } else {
    // When actorId is present it means someone added your bot got added to a new space
    // Lets find out more about them..
    var msg =
      "You can say `help` to get the list of words I am able to respond to." +
      "To start a new escalation, say `new`. To get your existing escalations," +
      "say `list`. To get the status of an escalation, say `status`.";
    bot.webex.people
      .get(actorId)
      .then((user) => {
        msg = `Hello there ${user.displayName}. ${msg}`;
      })
      .catch((e) => {
        console.error(
          `Failed to lookup user details in framwork.on("spawn"): ${e.message}`
        );
        msg = `Hello there. ${msg}`;
      })
      .finally(() => {
        // Say hello, and tell users what you do!
        if (bot.isDirect) {
          bot.say("markdown", msg);
        } else {
          let botName = bot.person.displayName;
          msg += `\n\nDon't forget, in order for me to see your messages in this group space, be sure to *@mention* ${botName}.`;
          bot.say("markdown", msg);
        }
      });
  }
});

//Process incoming messages

let responded = false;

/* 
  Help command
  Listen for iterations of help phrases and reply with help.
*/
framework.hears(
  /help|what can i (do|say)|what (can|do) you do/i,
  function (bot, trigger) {
    console.log(`someone needs help! They asked ${trigger.text}`);
    responded = true;
    bot
      .say(`Hello ${trigger.person.displayName}.`)
      .then(() => sendHelp(bot))
      .catch((e) => console.error(`Problem in help hander: ${e.message}`));
  }
);

/*
  List command
  List current open escalations for the requesting user.
*/
framework.hears("list", function (bot, trigger) {
  console.log("list command received");
  responded = true;
  bot.say("markdown", "Here's a list of your current escalations:");
});

/*
  Status command
  Get the status of a given escalation. Prompt the user
  if they have more than one open.
*/
framework.hears("status", function (bot, trigger) {
  console.log("status command received");
  responded = true;
  bot.say("markdown", "Here's the status of your current escalations:");
});

/*
  Close a current escalation.
  Prompt for the escalation to close and confirm before closing.
*/
framework.hears("close", function (bot, trigger) {
  console.log("close command received");
  responded = true;
  bot.say(
    "markdown",
    "Glad to hear your problem is resolved. Let's close that escalation."
  );
});

/*
  New command
  Create a new escalation.
  Responds with a card to collect details.
*/
framework.hears("new", function (bot, trigger) {
  console.log("new command received");
  responded = true;
  bot.sendCard(
    new_card,
    "Your client does not support buttons & cards. Please use an updated client."
  );
});

/*
  Respond to hello. Keep it friendly.
*/
framework.hears("hello", function (bot, trigger) {  
  console.log("heard a hello.");
  responded = true;
  bot.say("markdown", "Hello yourself! Try saying `new` to start a new escalation, or ask for `help`.");
});

/*
  When the user clicks on a card, we land here. Process the card, edit the card, etc.
*/
framework.on('attachmentAction', function (bot, trigger) {
  console.log("attachment receieved, processing card");
  bot.say(`Got an attachmentAction:\n${JSON.stringify(trigger.attachmentAction, null, 2)}`);

  var action = trigger.attachmentAction.inputs.action;
  var messageId = trigger.attachmentAction.messageId;

  if (action == "sub_theatre") {
    // They picked a theatre, so stick that value in the fact block
    bot.say(`Looks like you chose the ${JSON.stringify(trigger.attachmentAction.inputs.theatre)}.`)
  };
});

/* 
   Command we don't know how to handle.
*/
framework.hears(/.*/, function (bot, trigger) {
  // This will fire for any input so only respond if we haven't already
  if (!responded) {
    console.log(`catch-all handler fired for user input: ${trigger.text}`);
    bot
      .say(`Sorry, I don't know how to respond to "${trigger.text}"`)
      .then(() => sendHelp(bot))
      .catch((e) =>
        console.error(`Problem in the unexepected command hander: ${e.message}`)
      );
  }
  responded = false;
});

function sendHelp(bot) {
  bot.say(
    "markdown",
    "These are the commands I can respond to:",
    "\n\n " +
      "1. **new**   (create a new escalation) \n" +
      "2. **list**  (get your current escalations) \n" +
      "3. **status**  (get details about a current escalation) \n" +
      "4. **close** (close an escalation) \n"
  );
}

//Server config & housekeeping
// Health Check
app.get("/", function (req, res) {
  res.send(`I'm alive.`);
});

app.post("/", webhook(framework));

var server = app.listen(config.port, function () {
  framework.debug("framework listening on port %s", config.port);
});

// gracefully shutdown (ctrl-c)
process.on("SIGINT", function () {
  framework.debug("stoppping...");
  server.close();
  framework.stop().then(function () {
    process.exit();
  });
});
