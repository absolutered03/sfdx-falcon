//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @file          helpers/falcon-helper.ts
 * @copyright     Vivek M. Chawla - 2018
 * @author        Vivek M. Chawla <@VivekMChawla>
 * @version       1.0.0
 * @license       MIT
 * @requires      module:???
 * @summary       SFDX-Falcon general helper library
 * @description   Exports general helper classes & functions tightly related to the SFDX-Falcon
 *                framework.
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
// Imports
var noOp = 'Just need a line of code so JSDoc sees break between file header and first class/function';
// Requires

// Interfaces

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       FalconStatusReport
 * @access      public
 * @version     1.0.0
 * @summary     ????
 * @description ????
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
export class FalconStatusReport {
  private   startTime:      number  = -1;
  private   endTime:        number  = -1;
  private   runTime:        number  = -1;

  public    statusCode:     number  = -1;
  public    statusLog:      Array<string>;
  public    statusMessage:  string  = '';

  constructor (startTimer:boolean=false) {
    if (startTimer === true) {
      this.startTimer();
    }
    this.statusLog = new Array<string>();
  }

  public setStatusMessage(statusMessage:string):void {
    this.logStatusMessage(statusMessage);
    this.statusMessage = statusMessage;
  }

  public logStatusMessage(logMessage:string):void {
    this.statusLog.push(logMessage);
  }


  public startTimer() {
    if (this.endTime !== -1) {
      throw new Error('ERROR_TIMER_RUNNING: You can not restart a timer that has already been stopped.');
    }
    if (this.startTime !== -1) {
      throw new Error('ERROR_TIMER_RUNNING: You can not start a timer that is already running.');
    }
    let d = new Date();
    this.startTime = d.getTime();
  }

  public stopTimer():number {
    if (this.startTime === -1) {
      throw new Error('ERROR_TIMER_NEVER_STARTED: You can not stop a timer that was never started.');
    }
    if (this.endTime !== -1) {
      throw new Error('ERROR_TIMER_STOPPED: You can not stop a timer that is already stopped.');
    }
    let d = new Date();
    this.endTime = d.getTime();
    this.runTime = this.endTime - this.startTime;
    return this.runTime;
  }

  public getStartTime(returnString:boolean=false):number|string {
    if (returnString === true) {
      return this.printTime(this.startTime);
    }
    else {
      return this.startTime;
    }
  }

  public getEndTime(returnString:boolean=false):number|string {
    if (returnString === true) {
        return this.printTime(this.endTime);
    }
    else {
      return this.endTime;
    }
  }

  public getRunTime(returnString:boolean=false):number|string {
    if (this.startTime === -1) {
      throw new Error('ERROR_TIMER_NEVER_STARTED: You can get runtime from a timer that was never started.');
    }
    let returnRuntime = -1;
    if (this.runTime === -1) {
      let d = new Date();
      returnRuntime = d.getTime() - this.startTime;
    }
    else {
      returnRuntime = this.runTime;
    }
    if (returnString === true) {
      return `${returnRuntime/1000}`;
    }
    else {
      return returnRuntime;
    }
  }

  public getCurrentTime(returnString:boolean=false):number|string {
    let d = new Date();
    let currentTime = d.getTime();

    if (returnString === true) {
      return this.printTime(currentTime);
    }
    else {
      return currentTime;      
    }
  }

  private printTime(timeCode:number):string {
    let d = new Date(timeCode);
    let hours         = d.getHours();
    let minutes       = d.getMinutes().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false});
    let seconds       = d.getSeconds().toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping: false});
    let milliseconds  = d.getMilliseconds().toLocaleString('en-US', {minimumIntegerDigits: 3, useGrouping: false});

    return `${hours}:${minutes}:${seconds}:${milliseconds}`;

  }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @function    updateObserver
 * @param       {any}     observer  Required. Does nothing if typeof observer.next is undefined.
 * @param       {string}  message   Required. The message to be passed to observer.next().
 * @returns     {void}
 * @description Posts the provided message to observer.next() ONLY if an Observer was provided.
 * @version     1.0.0
] */
// ────────────────────────────────────────────────────────────────────────────────────────────────┘
export function updateObserver(observer:any, message:string):void {
  if (typeof observer.next !== 'function') return;
  if (typeof message === undefined) return;
  observer.next(message);
}