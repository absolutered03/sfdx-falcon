//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @file          modules/sfdx-falcon-prompt/index.ts
 * @copyright     Vivek M. Chawla - 2019
 * @author        Vivek M. Chawla <@VivekMChawla>
 * @summary       Exports SfdxFalconPrompt which provides user interaction via the console.
 * @description   Helps developers quickly build Inquirer based interviews. Can export Questions to
 *                external consumers (like Yeoman), or directly run Inquirer-based interactions.
 * @version       1.0.0
 * @license       MIT
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
// Import External Modules
//import {JsonMap}              from  '@salesforce/ts-types'; // ???

// Import Internal Modules
import {SfdxFalconDebug}      from  '../sfdx-falcon-debug';   // Specialized debug provider for SFDX-Falcon code.
//import {SfdxFalconError}      from  '../sfdx-falcon-error';   // Class. Extends SfdxError to provide specialized error structures for SFDX-Falcon modules.
import {AnswersDisplay}       from  '../sfdx-falcon-types';   // Type. Defines a function that displays answers to a user.
import {ConfirmationAnswers}  from  '../sfdx-falcon-types';   // Interface. Represents what an answers hash should look like during Yeoman/Inquirer interactions where the user is being asked to proceed/retry/abort something.
import {QuestionsBuilder}     from  '../sfdx-falcon-types';   // Type. Funcion type alias defining a function that returns Inquirer Questions.
import {Questions}            from  '../sfdx-falcon-types';   // Type. Alias to the Questions type from the yeoman-generator module.
import {SfdxFalconKeyValueTable}  from  '../sfdx-falcon-util/ux';         // Class. Uses table creation code borrowed from the SFDX-Core UX library to make it easy to build "Key/Value" tables.


// Requires
const inquirer = require('inquirer');  // A collection of common interactive command line user interfaces.

// Set the File Local Debug Namespace
const dbgNs = 'MODULE:sfdx-falcon-prompt:';



//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @interface   PromptOptions
 * @description Represents the options that can be set by the SfdxFalconPrompt constructor.
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
export interface PromptOptions<T extends object> {
  questions:            Questions | QuestionsBuilder;             // Required. Questions for the user.
  defaultAnswers:       T;                                        // Required. Default answers to the Questions.
  confirmation?:        Questions | QuestionsBuilder;             // Optional. Confirmation Questions.
  invertConfirmation?:  boolean;                                  // Optional. Treats
  display?:             AnswersDisplay<T>;                        // ???
  context?:             object;                                   // Optional. The scope of the caller who creates an SfdxFalconPrompt.
  data?:                object;                                   // Optional. ???
}

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       SfdxFalconPrompt
 * @summary     ???
 * @description ???
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
export class SfdxFalconPrompt<T extends object> {

  public readonly defaultAnswers:       T;                            // ???
  public userAnswers:                   T;                            // ???
  public confirmationAnswers:           ConfirmationAnswers;          // ???
  public context:                       object;                       // ???

  private readonly _questions:          Questions | QuestionsBuilder; // ???
  private readonly _confirmation:       Questions | QuestionsBuilder; // ???
  private readonly _display:            AnswersDisplay<T>;            // ???
  private readonly _invertConfirmation: boolean;                      // ???

  // Property accessors.
  public get confirmation():Questions {
    if (typeof this._confirmation === 'function') {
      return this._confirmation.call(this);
    }
    else {
      return this._confirmation;
    }
  }
  public get sharedData():object {
    return this.context['sharedData'];
  }
  public get finalAnswers():T {
    return {
      ...this.defaultAnswers as object,
      ...this.userAnswers as object
    } as T;
  }
  public get questions():Questions {
    if (typeof this._questions === 'function') {
      return this._questions.call(this);
    }
    else {
      return this._questions;
    }
  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @constructs  SfdxFalconPrompt
   * @param       {PromptOptions<T>} opts Required. Options that define the
   *              questions, default answers, confirmation questions, and
   *              Prompt Engine that should be used by this SfdxFalconPrompt
   *              object.
   * @description Constructs an SfdxFalconPrompt object.
   * @public
   */
  //───────────────────────────────────────────────────────────────────────────┘
  constructor(opts:PromptOptions<T>) {
    this._questions           = opts.questions;
    this._confirmation        = opts.confirmation;
    this._display             = opts.display;
    this._invertConfirmation  = opts.invertConfirmation || false;
    this.defaultAnswers       = opts.defaultAnswers;
    this.context              = opts.context  ||  {} as object;
    this.confirmationAnswers  = {} as ConfirmationAnswers;
    this.userAnswers          = {} as T;
  }

  //─────────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      prompt
   * @returns     {Promise<T>}  Returns the answers provided by the user.
   * @description ???
   * @public @async
   */
  //─────────────────────────────────────────────────────────────────────────────┘
  public async prompt():Promise<T> {

    // Start the question loop. If a "confirmation" is specified, the loop will
    // continue until the user indicates that they want to continue.
    do {

      // Debug
      SfdxFalconDebug.obj(`${dbgNs}prompt:`, this.questions, `this.questions: `);

      // Prompt the user and store the answers.
      this.userAnswers = await inquirer.prompt(this.questions) as T;
  
      // If there is anything to display, displayAnswers() will take care of it.
      await this.displayAnswers();

    } while (await this.confirmRestart());

    // Send back a combination of the default answers and the user's answers.
    return this.finalAnswers;
  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      confirmRestart
   * @returns     {Promise<boolean>}  Returns true if the user wants to restart,
   *              false if otherwise.
   * @description If this.confirmation contains Questions, prompts the user with
   *              those questions and then decides to continue or restart based
   *              on the answers.
   * @private @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  private async confirmRestart():Promise<boolean> {

    // Debug - Keep commented out unless needed for troubleshooting.
    //SfdxFalconDebug.obj(`${dbgNs}confirmRestart:`, this.confirmation, `this.confirmation: `);
    //SfdxFalconDebug.obj(`${dbgNs}confirmRestart:`, this.confirmationAnswers, `this.confirmationAnswers: `);

    // If "confirmation" is undefined then the user should be allowed to proceed.
    if (typeof this._confirmation === 'undefined') {
      this.confirmationAnswers.proceed  = true;
      this.confirmationAnswers.restart  = false;
      this.confirmationAnswers.abort    = false;
      return false;
    }

    // Tell Yeoman to prompt the user for confirmation of installation.
    this.confirmationAnswers = await inquirer.prompt(this.confirmation) as ConfirmationAnswers;

    // Separate confirmation from next action in UX with a blank line.
    console.log('');

    // DEBUG
    SfdxFalconDebug.obj(`${dbgNs}confirmRestart:`, this.confirmationAnswers, `this.confirmationAnswers: `);

    // Convert the "invert confirmation" and "restart" booleans into numbers.
    const invertConfirmation  = this._invertConfirmation ? 1 : 0;
    const restart             = this.confirmationAnswers.restart ? 1 : 0;

    // XOR the values of "invert" and "restart" numbers to get the correct boolean.
    return ((invertConfirmation ^ restart) === 0) ? false : true;

    // Return the value of the "restart" answer.
    return this.confirmationAnswers.restart;
  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      displayAnswers
   * @returns     {Promise<void>}
   * @description Uses the Display function (if present) to display the User
   *              Answers from the prompt to the user. If the Display function
   *              returns void, it means that it rendered output to the user.
   *              If it returns an Array, it means that we need to manually
   *              render the returned data in a FalconTable.
   * @private @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  private async displayAnswers():Promise<void> {

    // If there's a Display Function, use that to build/display the output.
    if (typeof this._display === 'function') {

      // The display function *might* render something on its own. If it does, it will return void.
      const displayResults = await this._display(this.userAnswers);

      // If the display function returned an Array, then we'll show it to the user with a Falcon Table.
      if (Array.isArray(displayResults)) {
        const falconTable = new SfdxFalconKeyValueTable();
        console.log('');
        falconTable.render(displayResults);
        console.log('');
      }
    }
  }
}
