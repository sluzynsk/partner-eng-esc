// Partner Engineering Escalation Bot
// Steven Luzynski <sluzynsk@cisco.com>
// October, 2021

let the_framework = require("webex-node-bot-framework");
let webhook = require("webex-node-bot-framework/webhook");
let express = require("express");
let bodyParser = require("body-parser");
let app = express();
app.use(bodyParser.json());
app.use(express.static("images"));
const config = require("./config.json");
let new_card_step1 = require("./new_card_step1.json");
let new_card_step2 = require("./new_card_step2.json");
let new_card_step3 = require("./new_card_step3.json");
let new_card_step4 = require("./new_card_step4.json");
const psm_map = require("./data.json");
const old_client =
  "Your client does not support buttons and cards. Please update and try again.";

let theatre = "";
let partner = "";
let customer = "";
let psm = "";
let issue = "";
let roomCreator = "";

// init framework
let framework = new the_framework(config);
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
    let msg =
      "You can say `help` to get the list of words I am able to respond to.\n\n" +
      "To start a new escalation, say `new`. To get your existing escalations," +
      "say `list`. To get the status of an escalation, say `status`.";
    bot.webex.people
      .get(actorId)
      .then((user) => {
        msg = `Hello there ${user.displayName}. ${msg}`;
        roomCreator = user.email;
      })
      .catch((e) => {
        console.error(
          `Failed to lookup user details in framework.on("spawn"): ${e.message}`
        );
        msg = `Hello there. ${msg}`;
      })
      .finally(() => {
        // Say hello, and tell users what you do!
        if (bot.isDirect) {
          bot.say(msg);
        } else {
          let botName = bot.person.displayName;
          msg += `\n\nDon't forget, in order for me to see your messages in this group space, be sure to *@mention* ${botName}.`;
          bot.say(msg);
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
  Status command
  Get the status of a given escalation. 
*/
framework.hears("status", function (bot, trigger) {
  console.log("status command received");
  responded = true;
  bot.say("Here's the status of your current escalation:");

  theatre = bot.recall("theatre");
  partner = bot.recall("partner");
  customer = bot.recall("customer");
  psm = bot.recall("psm");
  issue = bot.recall("issue");

  bot.say(`${partner} is working with ${customer} in ${theatre}.`);
});

/*
  Close a current escalation.
  Prompt for the escalation to close and confirm before closing.
*/
framework.hears("close", function (bot, trigger) {
  console.log("close command received");
  responded = true;
  bot.say(
    "Glad to hear your problem is resolved. Let's close that escalation."
  );
  bot.implode(); // This doesn't work in a 1:1 room, need exception handling. 
});

/*
  New command
  Create a new escalation.
  Responds with a card to collect details.
*/
framework.hears("new", function (bot, trigger) {
  console.log("new command received");
  responded = true;
  bot.sendCard(new_card_step1, old_client);
});

/*
  Respond to hello. Keep it friendly.
*/
framework.hears(/hello|hi/i, function (bot, trigger) {
  console.log("heard a hello.");
  responded = true;
  bot.say(
    "Hello yourself! Try saying `new` to start a new escalation, or ask for `help`."
  );
});

/*
  When the user clicks on a card, we land here. Process the card, edit the card, etc.
*/
framework.on("attachmentAction", function (bot, trigger) {
  console.log("attachment received, processing card");

  let action = trigger.attachmentAction.inputs.action;
  let messageId = trigger.attachmentAction.messageId;
  bot.censor(messageId);

  if (action === "sub_theatre") {
    theatre = trigger.attachmentAction.inputs.choices;
    bot.store("theatre", theatre);
    new_card_step2.body[3].facts[0].value = theatre;
    bot.sendCard(new_card_step2, old_client);
  } else if (action === "sub_partner") {
    partner = trigger.attachmentAction.inputs.choices;
    bot.store("partner", partner);
    // Map chosen partner to the PSM
    data = psm_map.filter((psm_map) => psm_map.partner == partner);
    psm = data[0].psm;
    bot.store("psm", psm);
    new_card_step3.body[3].facts[0].value = theatre;
    new_card_step3.body[3].facts[1].value = partner;
    new_card_step3.body[3].facts[2].value = psm;
    bot.sendCard(new_card_step3, old_client);
  } else if (action === "sub_customer") {
    customer = trigger.attachmentAction.inputs.customer;
    bot.store("customer", customer);
    new_card_step4.body[3].facts[0].value = theatre;
    new_card_step4.body[3].facts[1].value = partner;
    new_card_step4.body[3].facts[2].value = psm;
    new_card_step4.body[3].facts[3].value = customer;
    bot.sendCard(new_card_step4, old_client);
  } else if (action === "sub_issue") {
    issue = trigger.attachmentAction.inputs.issue;
    bot.store("issue", issue);
    bot.say(
      `Thank you for those details. I will now invite ${psm} to this space.`
    );
    bot.newRoom(`Engineering Escalation - ${partner}`,`${roomCreator},${psm}`,false);
    //bot.add(psm); // this doesn't work yet and definitely needs exception handling
    msg = `Hi, ${psm}. ${roomCreator} is having an issue with ${partner} that needs your attention.\n\n`;
    msg += `In their words, ${partner} is working with ${customer} and this has happened:\n\n\ ${issue}`;
    bot.say(msg);
  }
  // End of new card workflow.
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
        console.error(`Problem in the unexpected command handler: ${e.message}`)
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
      "2. **status**  (get details about a current escalation) \n" +
      "3. **close** (close an escalation) \n"
  );
}

//Server config & housekeeping
// Health Check
app.get("/", function (req, res) {
  res.send(`I'm alive.`);
});

app.post("/", webhook(framework));

let server = app.listen(config.port, function () {
  framework.debug("framework listening on port %s", config.port);
});

// gracefully shutdown (ctrl-c)
process.on("SIGINT", function () {
  framework.debug("stopping...");
  server.close();
  framework.stop().then(function () {
    process.exit();
  });
});
