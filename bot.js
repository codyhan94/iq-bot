var yawMap = {
  "cs":           0.022,
  "csgo":         0.022,
  "quake":        0.022,
  "source":       0.022,
  "overwatch":    0.0066,
  "ow":           0.0066,
  "rainbow6":     0.00572957795130823,
  "reflex":       0.00572957795130823,
  "fn":           0.55550,
  "fortnite":     0.55550,
  "doom":         0.0439453125,
  "qcde":         0.0439453125,
};

var low_iqs_global = new Set();

const CM_PER_INCH = 2.54;
const MM_PER_INCH = CM_PER_INCH * 10;

// for now just use degrees and cm as units. can add conversion tables later if
// desired.

// GetCM(yaw, sens, dpi)
function GetCM(yaw, sens, dpi) {
  // save increment (degrees per count)
  var inc = yaw * sens;
  var counts_per_rev = 360 / inc;
  return counts_per_rev / dpi * CM_PER_INCH;
}

// GetSens(yaw, cm, dpi)
function GetSens(yaw, cm, dpi) {
  var counts_per_rev = cm / CM_PER_INCH * dpi;
  var inc = 360 / counts_per_rev;
  return inc / yaw;
}

function DegToSens(yaw, deg, dpi) {
  var inc = deg * MM_PER_INCH / dpi;  // deg/mm * mm/inch * inch/count = deg/count
  return inc / yaw;
  // one-line: return deg * MM_PER_INCH / dpi / yaw;
}

function SensToDeg(yaw, sens, dpi) {
  var inc = sens * yaw;
  return inc * dpi / MM_PER_INCH;  // deg/count * count/inch * inch/mm = deg/mm
  // one-line: return yaw * sens * dpi / MM_PER_INCH
}

var Discord = require('discord.js');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;

const logger = createLogger({
  format: combine(
      timestamp(),
      prettyPrint()
      ),
  transports: [new transports.Console()]
});
var auth = require('./auth.json');
// Configure logger settings
//logger.remove(logger.transports.Console);
//logger.add(new logger.transports.Console, {
  //colorize: true
//});
//logger.level = 'debug';
// Initialize Discord Bot
var bot = new Discord.Client();
bot.once('ready', (evt) => {
  logger.info('Connected');
  logger.info('Logged in as: ');
  logger.info(bot.user);
  //logger.info(bot.user + ' - (' + bot.id + ')');
});

bot.login(auth.token)

  // commands:
  //  !cm game sens dpi -> cm/360
  //  !convert [game1] to [game2] sens1 dpi -> sens2
  //  !sens game cm dpi -> sens

var usage = `
commands:
!cm [game | yaw] sens cpi -> cm/rev
!convert [game1 | yaw1] to [game2 | yaw2] sens1 -> sens2
!sens [game | yaw] cm cpi -> sens
!deg [game | yaw] sens cpi -> deg (deg = 36/cm)
!games -> list of supported games
`

function GetYaw(arg) {
  var yaw = parseFloat(arg);
  if (!isNaN(yaw)) {
    return yaw;
  }
  game = arg.toLowerCase();
  if (!(game in yawMap)) {
    // use 0 so we can check truthiness of return value, as nothing has 0 yaw
    return 0;
  }
  return yawMap[game];
}

// function to sleep for some # of ms, and then call with .then(f) callback
const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RemoveRoleIn = async (msg, member, role, s, logger) => {
  await sleep(1000 * s);
  member.removeRole(role).catch(console.error);
  if (low_iqs_global.delete(member))
    logger.info('Removed ' + member.displayName + ' from low_iqs_global after ' + s + ' seconds.');
  msg.channel.send('Removed ' + role.name + ' from ' + member.displayName + ' after ' + s + ' seconds.');
}

function CheckAdmin(member) {
  return member.hasPermission("ADMINISTRATOR");
}

bot.on('guildMemberAdd', member => {
  // check if this person is on global low iq list and re-add low-iq if so
  if (low_iqs_global.has(member)) {
    var role = member.guild.roles.find(r => r.name === "low iq");
    member.addRole(role).catch(console.error);
    // TODO: extend timer for low iq role for this member
  }
});

//bot.on('message', function (user, userID, channelID, message, evt) {
bot.on('message', async message => {
  //console.log(message);
  //console.log(message.content);
  //console.log(typeof(message));
  msg = message.content;

  //var member = message.member;
  //if (!member) {
    //message.guild.fetchMember(message.author).then(m => member = m);
    ////catch(() => member = null);
  //}
  var member = message.member;
  if (!member) {
    logger.info('fetching un-cached member (sender) from guild...');
    member = await message.guild.fetchMember(message.author);
    logger.info('fetched un-cached member (sender): ' + member.displayName);
    //catch(() => member = null);
  }
  // Our bot needs to know if it will execute a command
  // It will listen for messages that will start with `!`
  if (msg.substring(0, 1) == '!') {
    // TODO: strings that have just ! will cause
    // UnhandledPromiseRejectionWarning: TypeError: Cannot read property 'toLowerCase' of undefined
    // at Client.bot.on (/usr/local/google/home/codyhan/projects/IQBot/bot.js:149:16)
    // at Client.emit (events.js:189:13)
    var args = msg.substring(1).split(/\s+/).filter(Boolean);
    var cmd = args[0];
    if (!cmd)  // no command, so we just had a single '!' as the message, no need to do anything
      return;
    var out = '';
    var send_msg = true;
    //console.log(args);
    //console.log(cmd);

    args = args.splice(1);
    switch(cmd.toLowerCase()) {
    case 'test':
      if (!CheckAdmin(member))
        break;
      for (let low_iq of low_iqs_global) {
        console.log(low_iq);
      }
      break;
    case 'lowiqs':
      out += 'Global low iqs: ';
      for (let low_iq of low_iqs_global) {
        out += low_iq.displayName + ', ';
      }
      break;
    case 'iq':
      // remove low iq role from mentioned users
      if (!CheckAdmin(member))
        break;
      var low_iqs = message.mentions.members;
      //console.log(low_iqs);
      if (low_iqs.size <= 0)
        break;
      var role = message.guild.roles.find(r => r.name === "low iq");
      var veg = message.guild.roles.find(r => r.name === "vegetable");
      var down = message.guild.roles.find(r => r.name === "downy");
      out += 'Removed low iq/vegetable/downy from: ';
      for (var [k, v] of low_iqs) {
        v.removeRole(role).catch(console.error);
        v.removeRole(veg).catch(console.error);
        v.removeRole(down).catch(console.error);
        if (low_iqs_global.delete(v)) {
          out += v.displayName + ', ';
        }
      }
      break;
    case 'lowiq':
      // TODO: make this fetch offline people properly
      // check if issuer has admin
      if (!CheckAdmin(member))
        break;
      // assign low iq role to mentioned user(s)
      var duration = args[args.length - 1];
      var temp = false;
      var low_iqs = message.mentions.members;
      var role = message.guild.roles.find(r => r.name === "low iq");
      out += 'Added low iq to: ';
      logger.info('low_iqs.size: ' + low_iqs.size);
      if (!isNaN(duration)) {
        //logger.info('have duration ' + duration + ' for args ' + args);
        //logger.info('applying low iq for ' + duration + ' seconds to:', message.mentions.members);
        let low_iq_names = '';
        message.mentions.members.tap(m => low_iq_names += m.displayName + ',');
        logger.info('applying low iq to ' + low_iq_names + ' for ' + duration + ' seconds.');
        temp = true;
        duration = parseInt(duration);
      }
      for (var [k, v] of low_iqs) {
        //logger.info(v);
        if (!v) {
          logger.info('fetching un-cached member (low iq) from guild...');
          v = await message.guild.fetchMember(v.user);
          logger.info('fetched un-cached member (low iq): ' + v.displayName);
        }
        v.addRole(role).catch(console.error);
        low_iqs_global.add(v);
        out += v.displayName + ', ';
        if (temp) {
          RemoveRoleIn(message, v, role, duration, logger);
        }
      }
      // ignore everything else in the line
      break;
    case 'downy':
      // TODO: make structure match the lowiq block
      // check if issuer has admin
      // TODO: put this entire block in its own function so that any !role
      // [mentions] duration can assign a role with optional duration. Also note
      // that we should return a message saying if it failed because the bot did
      // not have adequate permissions to assign that role.
      if (!CheckAdmin(member))
        break;
      // assign low iq role to mentioned user(s)
      var duration = args[args.length - 1];
      var temp = false;
      if (!isNaN(duration)) {
        //logger.info('have duration ' + duration + ' for args ' + args);
        logger.info('applying downy to ' + message.mentions.members + ' for ' + duration + ' seconds.');
        temp = true;
        duration = parseInt(duration);
      }
      var low_iqs = message.mentions.members;
      var role = message.guild.roles.find(r => r.name === "downy");
      out += 'Added downy to: ';
      for (var [k, v] of low_iqs) {
        if (!v) {
          logger.info('fetching un-cached member (downy) from guild...');
          v = await message.guild.fetchMember(v.user);
          logger.info('fetched un-cached member (downy): ' + v.displayName);
        }
        v.addRole(role).catch(console.error);
        low_iqs_global.add(v);
        out += v.displayName + ', ';
        if (temp) {
          RemoveRoleIn(message, v, role, duration, logger);
        }
      }
      // ignore everything else in the line
      break;
    case 'vegetable':
      // check if issuer has admin
      if (!CheckAdmin(member))
        break;
      // assign low iq role to mentioned user(s)
      var duration = args[args.length - 1];
      var temp = false;
      if (!isNaN(duration)) {
        //logger.info('have duration ' + duration + ' for args ' + args);
        logger.info('applying vegetable to ' + message.mentions.members + ' for ' + duration + ' seconds.');
        temp = true;
        duration = parseInt(duration);
      }
      var low_iqs = message.mentions.members;
      var role = message.guild.roles.find(r => r.name === "vegetable");
      out += 'Added vegetable to: ';
      for (var [k, v] of low_iqs) {
        if (!v) {
          logger.info('fetching un-cached member (vegetable) from guild...');
          v = await message.guild.fetchMember(v.user);
          logger.info('fetched un-cached member (vegetable): ' + v.displayName);
        }
        v.addRole(role).catch(console.error);
        low_iqs_global.add(v);
        out += v.displayName + ', ';
        if (temp) {
          RemoveRoleIn(message, v, role, duration, logger);
        }
      }
      // ignore everything else in the line
      break;
    case 'help':
    case 'usage':
      out = usage;
      break;
    case 'sens':
      if (args.length != 3) {
        out = usage;
        break;
      }

      var yaw = GetYaw(args[0]);
      // out = args[0] + ', ' + yaw.toString();
      // break;
      if (!yaw) {
        out = 'Supported games: ' + Object.keys(yawMap).join(',');
        break;
      }
      cm = args[1];
      dpi = args[2];
      out = GetSens(yaw, cm, dpi).toFixed(4).toString();
      break;
    case 'convert':
      if (args.length != 4) {
        out = usage;
        break;
      }
      yaw1 = GetYaw(args[0]);
      yaw2 = GetYaw(args[2]);
      if (!(yaw1 && yaw2)) {
        out = 'Supported games: ' + Object.keys(yawMap).join(',');
        break;
      }
      sens = parseFloat(args[3]);
      inc1 = sens * yaw1;
      out = (inc1 / yaw2).toFixed(4).toString();
      break;
    case 'cm':
      if (args.length != 3) {
        out = usage;
        break;
      }
      var yaw = GetYaw(args[0]);
      if (!yaw) {
        out = 'Supported games: ' + Object.keys(yawMap).join(',');
        break;
      }
      sens = args[1];
      dpi = args[2];
      out = GetCM(yaw, sens, dpi).toFixed(4).toString();
      break;
    case 'deg':
      if (args.length != 3) {
        out = usage;
        break;
      }
      var yaw = GetYaw(args[0]);
      if (!yaw) {
        out = 'Supported games: ' + Object.keys(yawMap).join(',');
        break;
      }
      sens = args[1];
      dpi = args[2];
      out = SensToDeg(yaw, sens, dpi).toFixed(4).toString();
      break;
    case 'calc':
      const expr = args.join('');
      const expr_valid = /^([-+]?\d+(\.\d*)?\s*?[-+/*^]?\s*?)*/;
      var match = expr.match(expr_valid);
      if (match.length <= 0 || match[0] != expr) {
        out = "invalid expression to calc";
        break;
      }
      out = String(eval(expr));
      break;
    case 'game':
    case 'games':
      out = 'Supported games: ' + Object.keys(yawMap).join(',');
      break;
    default:
      send_msg = false;
      //out = usage;
    }

    // trim trailing comma and whitespace
    out = out.replace(/,\s*$/g, '');
    if (temp) {
      out += ' for ' + duration + ' seconds.';
    }
    // construct reply mentioning the user
    var reply = "<@" + message.author.id + ">" + ": " + out;
    var chan;
    // send reply in specific channel for non-admins
    //logger.info('checking admin before posting for member: ' + member.displayName);
    if (member != null && !CheckAdmin(member)) {
      chan = message.guild.channels.find(channel => channel.name === "commandes");
    } else {
      chan = message.channel;
    }
    if (!chan) {  // fall back to the original channel if the specific channel doesn't exist
      chan = message.channel;
    }
    if (send_msg && out.length > 0) {
      chan.send(reply);
    }
  }
});
