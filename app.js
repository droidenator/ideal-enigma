'use strict';

const bodyParser = require('body-parser');
const env = require('node-env-file');
const express = require('express');
const r = require('rethinkdb');
const request = require('request');

const app = express();
const port = process.env.PORT || 3000;

try {
  env(__dirname + '/.env');
} catch(e) {
  if(!process.env.PUSHOVER_TOKEN || !process.env.DB_NAME) {
    console.error('ERROR: PUSHOVER_TOKEN and DB_NAME environment variables are required.');
    process.exit(1);
  }
}

let dbConn;
let activeNotifications = {};

app.use('/', express.static('public'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

/** Events **/
app.get('/api/events', getEvents);
app.post('/api/event', addEvent);

/** Tasks **/
app.get('/api/tasks', getTasks);
app.post('/api/task', addTask);
app.post('/api/task/update', updateTask);

//Get tasks
function getTasks(req, res) {
  r.table('task')
    .run(dbConn)
    .then(cursor => cursor.toArray())
    .then(results => res.send(results));
}

//Create task
function addTask(req, res) {
  let task = transformTask(req.body);

  r.table('task')
    .insert(task, { returnChanges: true })
    .run(dbConn)
    .then(function(result) {
      res.send(result.changes[0].new_val);
    });
}

//Mark task as done
function updateTask(req, res) {
  let task = transformTask(req.body);

  r.table('task')
    .get(task.id)
    .update({ due: parseInt(task.due) })
    .run(dbConn)
    .then(result => res.send(result));
}
//Get history
function getEvents(req, res) {
  r.table('event')
    .orderBy( r.desc('time') )
    .run(dbConn)
    .then(cursor => cursor.toArray())
    .then(results => res.send(results));
}

//Add to history
function addEvent(req, res) {
  if(activeNotifications[req.body.taskId]) {
    activeNotifications[req.body.taskId] = false;
  }
  r.table('event')
    .insert(req.body, { returnChanges: true})
    .run(dbConn)
    .then(results => res.send(results.changes[0].new_val));
}

//Monitor when alerts run
function checkTasks() {
  r.table('task')
    .filter( r.row('due').lt(new Date().getTime()) )
    .run(dbConn)
    .then(cursor => cursor.toArray())
    .then(results => {
      results.forEach(result => {
        if(!activeNotifications[result.id]) {
          activeNotifications[result.id] = true;
          getUsers()
            .then(users => {
              users.forEach(user => {
                notify(
                  user.userKey,
                  `Task "${result.name}" is due.`
                );
              });
            });

          console.log(`Notifying for task ${result.id}`);
        }
      });
    });
    // .then(results => console.log(new Date().toLocaleString(), results));
}

function getUsers() {
  return r.table('user')
    .run(dbConn)
    .then(cursor => cursor.toArray())
}


//Notify when alert runs
function notify(userToken, message) {
  if(!userToken || !message) {
    return false;
  }

  request.post('https://api.pushover.net/1/messages.json')
    .form({
      token: process.env.PUSHOVER_TOKEN,
      user: userToken,
      message: message
    });
}

//Authenticate


function transformTask(originalTask) {
  let task = Object.assign({}, originalTask);
  task.due = parseInt(task.due);
  task.interval = parseInt(task.interval);
  return task;
}

function dbConnect(config) {
  return r.connect(config)
    .then(conn => {
      dbConn = conn;
      setInterval(checkTasks, 60000);
    });
}

dbConnect({
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 28015,
        authKey: process.env.DB_AUTHKEY || '',
        db: process.env.DB_NAME
    });

app.listen(port, () => console.log(`Server started on ${port}`));
