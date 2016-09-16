const lock = new Auth0Lock(
  '', //AUTH0 CLIENT ID
  '' //AUTH DOMAIN 
);

// Listening for the authenticated event
lock.on("authenticated", function(authResult) {
  // Use the token in authResult to getProfile() and save it to localStorage
  lock.getProfile(authResult.idToken, function(error, profile) {
    if (error) {
      // Handle error
      return;
    }
    localStorage.setItem('token', authResult.idToken);
    localStorage.setItem('profile', JSON.stringify(profile));

    startApp();
    lock.hide();
  });
});

const LogoutButton = React.createClass({
  logoutHandler: function() {
    localStorage.removeItem('token');
    localStorage.removeItem('profile');
    window.location.reload();
  },
  render: function() {
    return (
      <button className="u-pull-right logout-bttn" onClick={this.logoutHandler}>Logout</button>
    );
  }
});

const EventLog = React.createClass({
  render: function() {
    const findById = this.props.findElement;

    var eventNodes = this.props.events.map(function(event) {
      const task = findById('tasks', event.taskId);
      const user = findById('users', event.userId);
      const time = new Date(event.time);

      return (
        <tr key={event.id}>
          <td>{task.name}</td>
          <td>{user.name}</td>
          <td>{time.toLocaleString()}</td>
        </tr>
      );
    });

    return (
      <div>
        <h2>Event log</h2>
        <table className="u-full-width">
          <thead>
            <tr>
              <th>Task</th>
              <th>Completed By</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {eventNodes}
          </tbody>
        </table>
      </div>
    )
  }
});

const TaskBox = React.createClass({
  clearTask: function(id) {
    let data = this.state.tasks;
    data.some(item => {
      if(item.id === id) {
        item.due = new Date().getTime() + item.interval;
        $.ajax({
          url: '/api/task/update',
          dataType: 'json',
          type: 'POST',
          data: item,
          success: function(response) {
            console.log(response);
            this.logEvent(id, 1);
            this.setState({ data });
          }.bind(this),
          error: function(xhr, status, err) {
            console.error('doh', status, err.toString())
          }.bind(this)
        });
        return true;
      }
    });
  },
  componentDidMount: function() {
    this.loadTasks();
  },
  handleFormSubmit: function(taskData) {
    let task = {};
    let tasks = this.state.tasks.slice(0);

    task.name = taskData.taskName;
    task.interval = taskData.hours + taskData.minutes;
    task.due = new Date().getTime() + task.interval;
    $.ajax({
      url: '/api/task',
      dataType: 'json',
      type: 'POST',
      data: task,
      success: function(newTask) {
        tasks.unshift(newTask);
        this.setState({ tasks: this.updateTimeRemaining(tasks) });
      }.bind(this),
      error: function(xhr, status, err) {
        console.error('doh', status, err.toString())
      }.bind(this)
    });
  },
  getInitialState: function() {
    let events = [];
    let tasks = [];
    let users = [
      {
        id: 1,
        name: 'Sean'
      },
      {
        id: 2,
        name: 'Laurie'
      }
    ];

    return {
      events: [],
      tasks: [],
      users
    };
  },
  findById: function(type, id) {
    if(!this.state[type]) {
      console.error('Invalid type');
      return;
    }
    return this.state[type].find(item => item.id === id);
  },
  loadEvents: function(nextFn) {
   $.ajax({
      url: '/api/events',
      dataType: 'json',
      cache: false,
      success: data => {
        let mappedEvents = data.map(this.transformEvent);
        this.setState({ events: mappedEvents });
      },
      error: err => console.log(err.toString())
    });
  },
  loadTasks: function() {
    $.ajax({
      url: '/api/tasks',
      dataType: 'json',
      cache: false,
      success: data => {
        let mappedTasks = data.map(item => {
          item.due = parseInt(item.due);
          item.interval = parseInt(item.interval);
          return item;
        });
        this.setState({ tasks: this.updateTimeRemaining(data) });
        this.loadEvents();
      },
      error: err => console.log(err.toString())
    });
  },
  logEvent: function(taskId, userId) {
    let events = this.state.events;
    let event = {
      taskId,
      time: new Date().getTime(),
      userId
    };
    $.ajax({
      url: '/api/event',
      dataType: 'json',
      type: 'POST',
      data: event,
      success: (result) => {
        events.unshift(this.transformEvent(result));
        this.setState({ events });
      },
      error: err => console.log(err.toString())
    });
  },
  transformEvent: function(event) {
    event.time = parseInt(event.time);
    event.userId = parseInt(event.userId);
    return event;
  },
  transformTask: function(task) {
    task.due = parseInt(task.due);
    task.interval = parseInt(task.interval);
    return item;
  },
  render: function() {
    return (
      <div className="taskBox">
        <h1>Tasks</h1>
        <TaskList data={this.state.tasks} onClickHandler={this.clearTask} intervalHandler={this.updateTimeRemaining}/>
        <EventLog events={this.state.events} findElement={this.findById} />
        <TaskForm onTaskFormSubmit={this.handleFormSubmit} />
      </div>
    );
  },
  updateTimeRemaining: function(items) {
    return items.map(function(item) {
      item.due = parseInt(item.due);
      item.interval = parseInt(item.interval);

      let current = new Date();
      let dueDate = new Date(item.due);
      let dateDiff = (dueDate - current) / 1000 / 60;

      item.elligble = (current >= dueDate);
      item.offset = dateDiff;
      item.remaining = {
        hours: Math.floor(dateDiff / 60),
        minutes: Math.floor(dateDiff % 60),
        seconds: Math.floor((dateDiff % 1) * 60)
      };

      return item;
    });
  }
});

const TaskForm = React.createClass({
  buildHours: function(max = 24) {
    let hours = [];
    for(let i = 0; i <= max; i++) {
        hours.push({
          key: convertToMicroseconds(i),
          value: i
        });
    }
    return hours;
  },
  buildMinutes: function(minutes) {
    return minutes.map(function(item) {
      return {
        key: convertToMicroseconds(0,item),
        value: item
      }
    });
  },
  buildSelectElement: function(dataObj) {
    var {data, stateKey, defaultText, onSelect} = dataObj;
    var options = data.map(function(item) {
      return (
        <option key={item.key} value={item.key}>{item.value}</option>
      )
    });
    return (
      <div className="six columns">
        <label>{defaultText}</label>
        <select className="u-full-width" value={this.state[stateKey]} onChange={onSelect(stateKey)}>
          <option value=''>{defaultText}</option>
          {options}
        </select>
      </div>
    );
  },
  getInitialState: function() {
    return {
      hours: '',
      minutes: '',
      taskName: ''
    }
  },
  handleSubmit: function(e) {
    e.preventDefault();

    var hours = parseInt(this.state.hours);
    var minutes = parseInt(this.state.minutes);
    var taskName = this.state.taskName.trim();

    if(isNaN(hours) || isNaN(minutes) || !taskName) {
      return;
    }

    this.props.onTaskFormSubmit({ hours, minutes, taskName });
    this.setState(this.getInitialState());
  },
  handleInputChange: function(stateKey) {
    return function(e) {
      let update = {};
      update[stateKey] = e.target.value
      this.setState(update);
    }.bind(this);
  },
  render: function() {
    var hoursSelect = this.buildSelectElement({
      data: this.buildHours(),
      stateKey: 'hours',
      defaultText: 'Hours',
      onSelect: this.handleInputChange
    });
    var minutesSelect = this.buildSelectElement({
      data: this.buildMinutes([0,15,30,45]),
      stateKey: 'minutes',
      defaultText: 'Minutes',
      onSelect: this.handleInputChange
    });
    return (
      <div>
        <h2>Add new task</h2>
        <form className="taskForm" onSubmit={this.handleSubmit}>
          <div className="interval-picker row">
            {hoursSelect} {minutesSelect}
          </div>
          <div className="row">
            <div className="eight columns">
              <input className="u-full-width" type="text"
                     value={this.state.taskName}
                     onChange={this.handleInputChange('taskName')}
                     placeholder="Task name" />
            </div>
            <div className="four columns">
              <input className="u-full-width" type="submit" value="Save" />
            </div>
          </div>
        </form>
      </div>
    )
  }
});

const TaskList = React.createClass({
  componentDidMount: function() {
    setInterval(function() {
      const items = this.props.intervalHandler(this.props.data);
      this.setState({ data: items });
    }.bind(this), 250);
  },
  leftPad: function(value, minLength) {
    minLength = minLength | 2;
    let paddedValue = value.toString();
    if(paddedValue.length < minLength) {
      paddedValue = '0' + paddedValue;
    }
    return paddedValue;
  },
  render: function() {
    this.props.data.sort(function(a, b) {
      return a.offset - b.offset;
    });
    const tasks = this.props.data.map(task => {
      let displayDate = task.elligble
        ? 'Available'
        : `${task.remaining.hours}:${this.leftPad(task.remaining.minutes)}:${this.leftPad(task.remaining.seconds)}`;
      let buttonClass = task.elligble ? 'button-primary u-full-width' : 'u-full-width';
      return (
        <div className="row" key={task.id}>
          <div className="twelve columns">
            <button className={buttonClass} onClick={() => this.props.onClickHandler(task.id)}>
            {task.name}
              <span>{displayDate}</span>
            </button>
          </div>
        </div>
      )
    });

    return (
      <div className="tasks">
        {tasks}
      </div>
    );
  }
});

function convertToMicroseconds(hours = 0, minutes = 0) {
  return (1000 * 60 * 60 * hours) + (1000 * 60 * minutes);
}

function startApp() {
  ReactDOM.render(
    <div>
      <LogoutButton />
      <TaskBox />
    </div>,
    document.getElementById('content')
  );
}

if(localStorage.token) {
  startApp();
} else {
  lock.show();
}
