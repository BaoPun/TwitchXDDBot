/* 
https://id.twitch.tv/oauth2/authorize?response_type=token&client_id={put_client_id_here}&redirect_uri=http://localhost:3000&scope=chat%3Aread+chat%3Aedit

To get access token, run above link (replace client_id as necessary) and then find the access token in the newly generated uri.
*/

// Import variables from ref.js made
// TIL: importing local variables from other js files makes them CONST type.  
import { tmi, fs, access_token } from './ref.js';

// Used for !bottime command to see how long the bot has been up.
var uptime = -1;

// Create a counter variable to store xdd counts.
var counter = 0; 

// Add cooldowns to each individual command to prevent spamming (60 seconds for now).
var cooldown = [-1, -1, -1, -1, -1, -1, -1, -1, -1, -1];


// Define configuration options
const opts = {
  identity: {
    username: 'elrato_bot',     
    password: `oauth:${access_token}`
  },
  channels: [
    'caedrel',
    // add more channels below if you want.  but channels[0] is the primary channel used.
  ],
};

// Constants for xdd-specific emotes that do not have an obvious pattern 
//const xddArray = ['xderics', 'xxd', 'xff', 'dd', 'fdding', 'Chat', 'dxd', 'dddd', 'SCANNERMANS', 'MERCSLAMONT', 'xdg', 'eggsdd', 'shdd'];

// Possible emotes for slots
//const slotsArray = ['BibleThump', 'Kappa', 'BigBrother', 'EleGiggle', 'LUL', 'PogBones', 'BatChest'];


// Create a client with our options
const client = new tmi.client(opts);

// Register our event handlers (defined below)
client.on('message', onMessageHandler);
client.on('connected', onConnectedHandler);

// Connect to Twitch:
client.connect();

// Called upon connection to Twitch chat
function onConnectedHandler (addr, port) {
    console.log(`* Connected to ${addr}:${port}`);
    client.say(client.getOptions().channels[0], 'Elrato Bot is now online.  Type !help to view all possible commands.');
    uptime = new Date().getTime();

    // Pull old counter data from a local text file called counter.txt
    // If file does not exist, make one and write 0 to counter.txt
    // Otherwise, pull the data and store it into the counter variable
    let fileOpened = true;
    fs.readFile('./counter.txt', 'utf8', (err, data) => {
        if(err){
            console.log(err);
            fileOpened = false;
        }
        else{
            counter = parseInt(data);
            console.log(`xdd counter starting with ${counter}`);
        }
    });

    if(!fileOpened){
        console.log('File does not exist, creating a new file called counter.txt');
        writeXddCounter(0, `#${client.getOptions().channels[0]}`);
    }

    // Set an asynchronous timer to print an automated message every 5 minutes.
    // In the offline scenario, CD must be shorter there than here.  5 minutes here vs 1.5 minutes there. 
    setInterval(async () => {
        checkStreamerLive(client.getOptions().channels[0].substring(1));
    }, 1000 * 300);
}

// Called every time a message comes in
function onMessageHandler (target, context, msg, self) {
    // Ignore messages from the bot
    if (self)
        return; 

    // Remove whitespace from chat message
    const message = msg.trim();

    // If the command is known, let's execute it

    // Only myself and the broadcaster may close the bot.
    if(message == '!exit' && (context['username'] == 'icant_kekw' || context['username'] == target.substring(1))){
        client.say(target, 'Elrato Bot is now offline.');
        console.log(`final xdd counter = ${counter}`);

        // Persist the counters before closing.
        writeXddCounter(counter, target);

        // After printing out the final message, leave the channel, and disconnect from the server
        client.part(target);
        client.disconnect();

        // Finally, exit the bot
        process.exit(0);
    }

    // xdd and its other variants
    // Per streamer request, only count xdd itself for now.
    /*if((commandName in xddArray || /xdx/.test(commandName) || /xdd/i.test(commandName) || /ddx/.test(commandName) || /ppx/.test(commandName) || /xpp/.test(commandName) ||  /xtd/.test(commandName))  && !/!xdd/i.test(commandName)){
        ++counter[1];
    }*/
    
    // Typing !xdd will display the # of xdd messages
    else if(message == '!xdd'){
        if(isOffCooldown(0)){
            // To see the xdd counter, you must type !xdd
            client.say(target, `xdd was found ${counter} time(s) in this stream.`);
            console.log('xdd counter');
        }
    }

    // Typing !bottime will display how long the bot has been online for
    else if(message == '!bottime'){
        if(isOffCooldown(1)){
            client.say(target, `Elrato Bot has been online for ${calculateUpTime()}`);
            console.log('timer');
        }
    }

    // Typing !help will display all possible commands to use
    else if(message == '!help'){
        if(isOffCooldown(2)){
            client.say(target, 'List of possible commands: !xdd, !bottime, !save.  Each command usage has a 60 second cooldown.');
            console.log('help');
        }
    }

    // Typing !save will save the current counter
    else if(message == '!save'){
        if(isOffCooldown(3)){
            writeXddCounter(counter, target, true);
            console.log('Save');
        }
    }

    // For all other non-commands, count the number of sally and xdd (and plink and showmaker) in the sent message.
    else{
        counter += regexCountInMessage(message, /((?<![\w\d])xdd)( |$)/g);
    }

    // Slots (not allowed to be used)
    /*
    if(commandName == '!slots'){
        if(isOffCooldown(7, 10)){
            // Randomly generate three emotes and output each
            const emote1 = generateEmote();
            const emote2 = generateEmote();
            const emote3 = generateEmote();

            // Print out output message.  Did you win?
            client.say(target, `${emote1} ${emote2} ${emote3} => ${emote1 == emote2 && emote2 == emote3 ? 'You won!' : 'You lost...'}`);
        }
    }
    */
}

// Helper functions below

// Write to file the provided content to save the xdd counter
// This must be done synchronously
function writeXddCounter(content, streamer, write = false){
    try{
        fs.writeFileSync('./counter.txt', `${content}\n`);
        if(write)
            client.say(streamer, `Successfully saved xdd counter.`);
    }
    catch(err){
        console.log(`There was a problem with writing to the file: ${err}`);
    }
}

// Called to determine if given streamer is live.
// If streamer is live, then display the help message.
// If not live, terminate the bot after 5 minutes.
async function checkStreamerLive(streamer){
    try{
        const response = await fetch(`https://www.twitch.tv/${streamer}`);
        const source = await response.text();

        // Persist the counters.
        writeXddCounter(counter, `#${streamer}`);
            
        // As of 2021, if a streamer is live, the source code will contain the key 'isLiveBroadcast'
        // If streamer is live, then display the message to use the !help command
        if(source.includes('isLiveBroadcast')){
            client.say(`#${streamer}`, 'Type !help to view all possible commands.  Made by icant_kekw.');
        }

        // Otherwise, give a warning to chat that the bot will be deactivated in the next 90 seconds.
        // IMPERATIVE THAT CD HERE IS SHORTER THAN CD IN SETINTERVAL
        else{
            client.say(`#${streamer}`, `${streamer} is not live, deactivating bot in 90 seconds.`);
            setTimeout(async () => {
                client.say(`#${streamer}`, 'Elrato Bot is now offline.');
                console.log(`final xdd counter = ${counter}`);

                // After printing out the final message, leave the channel, and disconnect from the server
                client.part(`#${streamer}`);
                client.disconnect();

                // Finally, exit the bot
                process.exit(0);
            }, 1000 * 90);
        }
    }
    catch(error){
        console.log('Error occurred.');
    }
}


// Function that calculates the uptime of the bot - in hours, minutes, and seconds.
function calculateUpTime(){
    // New calculated time will always be later than the uptime.
    let time = (new Date().getTime()) - uptime;
    
    // Time is in milliseconds; we want to split this into hours, minutes, and seconds.
    let hours = Math.floor((time / 1000 / 60 / 60) % 24);       // ms => 1 s / 1000 ms * 1 min / 60 s * 1 hr / 60 min;  24 hours in 1 day
    let minutes = Math.floor((time / 1000 / 60) % 60);          // ms => 1 s / 1000 ms * 1 min / 60 s;                  60 minutes in 1 hr
    let seconds = Math.floor((time / 1000) % 60);               // ms => 1 s / 1000 ms;                                 60 seconds in 1 minute
    
    // Return a string representation of the split hours, minutes, seconds
    return `${hours} hour(s), ${minutes} minute(s), and ${seconds} second(s).`;
}

// Function to determine the number of times a message matches a regular expression with global search
function regexCountInMessage(message, regex){
    return (message.match(regex) || []).length;
}

// Function called to randomly generate an emote via !slots
function generateEmote(){
    return slotsArray[Math.floor(Math.random() * 7)];
}

// Function called to determine if given index of command is off cooldown.
function isOffCooldown(idx, seconds = 60){
    // First, create snapshot of the current time (in ms)
    let time = new Date().getTime();

    // Store into pos idx if -1 is there, and also immediately display the message.
    if(cooldown[idx] == -1){
        cooldown[idx] = time;
        return true;
    }

    // Otherwise, compute the new time and see if at least 60 seconds have elapsed
    // If so, replace the time in pos idx and return true.
    // Otherwise, leave it alone
    else{
        if(time - cooldown[idx] > seconds * 1000){
            cooldown[idx] = time;
            return true;
        }
    }

    // Default behavior: return false
    return false;
}

