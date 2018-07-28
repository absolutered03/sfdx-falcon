//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @file          helpers/adk-helper.ts
 * @copyright     Vivek M. Chawla - 2018
 * @author        Vivek M. Chawla <@VivekMChawla>
 * @version       1.0.0
 * @license       MIT
 * @requires      module:debug
 * @requires      module:inquirer
 * @requires      module:path
 * @requires      module:shelljs
 * @requires      module:validators/core
 * @summary       AppExchange Demo Kit (ADK) helper library
 * @description   Exports classes & functions that provide the core services of the AppExchange 
 *                Demo Kit (ADK).
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
// Imports
import {core}                   from  '@salesforce/command';      // Allows us to use SFDX core functionality.
import * as path                from 'path';                      // Node's path library.
import {AppxDemoLocalConfig}    from '../falcon-types';           // Why?
import {AppxDemoProjectConfig}  from '../falcon-types';           // Why?
import {FalconCommandSequence}  from '../falcon-types';           // Why?
import {FalconConfig}           from '../falcon-types';           // Why?
import {FalconStatusReport}     from '../helpers/falcon-helper';  // Why?
import {INTENT}                 from '../enums';                  // Why?
//import * as shell               from 'shelljs';                   // Why?
import {waitASecond}            from '../helpers/async-helper';   // Why?
import { SfdxCommandSequence } from './sequence-helper';

// Requires
const debug         = require('debug')('adk-helper');             // Utility for debugging. set debug.enabled = true to turn on.
const debugAsync    = require('debug')('adk-helper(ASYNC)');      // Utility for debugging. set debugAsync.enabled = true to turn on.
const debugExtended = require('debug')('adk-helper(EXTENDED)');   // Utility for debugging. set debugExtended.enabled = true to turn on.

// Initialize Globals
debug.enabled         = false;
debugAsync.enabled    = false;
debugExtended.enabled = false;

//─────────────────────────────────────────────────────────────────────────────┐
// Set shelljs config to throw exceptions on fatal errors.  We have to do
// this so that Git/SFDX commands that return fatal errors can have their
// output suppresed while the generator is running.
//─────────────────────────────────────────────────────────────────────────────┘
//shell.config.fatal = true;

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       AppxDemoProject
 * @access      public
 * @version     1.0.0
 * @description Creates an Object that represents an AppExchange Demo Kit project on the user's
 *              local machine.  This includes member variables that hold all of the ADK project
 *              variables and member functions that encapsulate all of the actions the ADK can 
 *              take on behalf of the user.
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
export class AppxDemoProject {

  //───────────────────────────────────────────────────────────────────────────┐
  // Define class member variables/types.
  //───────────────────────────────────────────────────────────────────────────┘
  private   demoBuildConfig:        FalconCommandSequence;  // Why?
  private   appxDemoLocalConfig:    AppxDemoLocalConfig;    // Why?
  private   appxDemoProjectConfig:  AppxDemoProjectConfig;  // Why?
  private   projectFalconConfig:    FalconConfig;           // Why?
  private   targetOrgAlias:         string;                 // Why?
  private   executionIntent:        INTENT;                 // Why?
  private   executingSequence:      boolean;                // Why?
  private   scratchDefJson:         string;                 // Why?
  private   skipUserCreation:       boolean;                // Why?

  public    demoDeploymentOrgAlias: string;                 // Why?
  public    demoValidationOrgAlias: string;                 // Why?
  public    devHubAlias:            string;                 // Why?
  public    envHubAlias:            string;                 // Why?
  public    projectPath:            string;                 // Why?

  // TODO: If we don't use these four members outside of the
  //       constructor, get rid of them
  //private   demoBuildConfigFile:    core.ConfigFile;        // Why?
  //private   localFalconConfigFile:  core.ConfigFile;        // Why?
  //private   sfdxProject:            core.SfdxProject;       // Why?
  //private   sfdxProjectConfig:      object;                 // Why?


  //───────────────────────────────────────────────────────────────────────────────────────────────┐
  /**
   * @constructs  AppxDemoProject
   * @version     1.0.0
   * @param       {SfdxProject} sfdxProject Required.
   *              An SfdxProject context as returned by a call to SfdxProject.resolve().
   * @param       {object}  sfdxProjectConfig Required.
   *              The resolved set of SFDX Project config settings for the SfdxProject.
   * @param       {ConfigFile}  localFalconConfigFile Required.
   *              A ConfigFile object that should have been populated by a local SFDX-Falcon config.
   * @description Constructs an AppxDemoProject object.
   */
  //───────────────────────────────────────────────────────────────────────────────────────────────┘
  constructor(sfdxProject:core.SfdxProject, sfdxProjectConfig:object, 
    localFalconConfigFile:core.ConfigFile, demoBuildConfigFile:core.ConfigFile) {

    //─────────────────────────────────────────────────────────────────────────┐
    // Make sure that we get a value passed in to each parameter.
    //─────────────────────────────────────────────────────────────────────────┘
    if (typeof sfdxProject === 'undefined' 
    ||  typeof sfdxProjectConfig === 'undefined' 
    ||  typeof localFalconConfigFile === 'undefined' 
    ||  typeof demoBuildConfigFile === 'undefined') {
    throw new Error(`ERROR_MISSING_ARGUMENTS: Expected four arguments but only got ${arguments.length}`);
    }

    //─────────────────────────────────────────────────────────────────────────┐
    // Attempt to pull data from the incoming parameters.  If the proper 
    // data types were not provided, then it's likely that someone tried to
    // directly construct an AppxDemoProject object.  That's not allowed, so we 
    // want to catch anything unexpected then throw a custom ERROR.
    //─────────────────────────────────────────────────────────────────────────┘
    try {
    this.projectPath = sfdxProject.getPath();
    debug(`this.projectPath: \n%O`, this.projectPath);

    this.appxDemoLocalConfig = localFalconConfigFile.toObject().appxDemo as any;
    debug(`this.appxDemoLocalConfig: \n%O`, this.appxDemoLocalConfig);

    this.appxDemoProjectConfig = (sfdxProjectConfig as any).plugins.sfdxFalcon.appxDemo;
    debug(`this.appxDemoProjectConfig: \n%O`, this.appxDemoProjectConfig);

    this.demoBuildConfig = demoBuildConfigFile.toObject() as any;
    debug(`this.demoBuildConfig: \n%O`, this.demoBuildConfig);

    this.devHubAlias = this.appxDemoLocalConfig.devHubAlias;
    debug('this.devHubAlias: %s', this.devHubAlias);

    this.envHubAlias = this.appxDemoLocalConfig.envHubAlias;
    debug('this.envHubAlias: %s', this.envHubAlias);

    this.demoDeploymentOrgAlias = this.appxDemoLocalConfig.demoDeploymentOrgAlias;
    debug('this.demoDeploymentOrgAlias: %s', this.demoDeploymentOrgAlias);

    this.demoValidationOrgAlias = this.appxDemoLocalConfig.demoValidationOrgAlias;
    debug('this.demoValidationOrgAlias: %s', this.demoValidationOrgAlias);
    }
    catch (parseError) {
    throw new Error (`ERROR_UNPARSED_CONFIG: ${parseError}`);
    }

    //─────────────────────────────────────────────────────────────────────────┐
    // Validate the FalconCommandSequence JSON that was loaded into the 
    // demoBuildConfig variable.  If it's not valid, throw an error.
    //─────────────────────────────────────────────────────────────────────────┘
    let demoBuildConfigValidationResponse = validateDemoBuildConfig(this.demoBuildConfig);
    if (demoBuildConfigValidationResponse !== true) {
    throw new Error(`ERROR_INVALID_CONFIG: Configuration in ${this.projectPath}/demo-config/${this.appxDemoProjectConfig.demoBuildConfig} has missing/invalid settings (${demoBuildConfigValidationResponse}).`)
    }

    //─────────────────────────────────────────────────────────────────────────┐
    // Parse the Demo Build Config to set key properties.
    //─────────────────────────────────────────────────────────────────────────┘
    this.scratchDefJson = this.demoBuildConfig.options.scratchDefJson;
    debug('this.scratchDefJson: %s', this.scratchDefJson);

    this.skipUserCreation = this.demoBuildConfig.options.skipUserCreation;
    debug('this.skipUserCreation: %s', this.skipUserCreation);

    //─────────────────────────────────────────────────────────────────────────┐
    // Set any final member variables.
    //─────────────────────────────────────────────────────────────────────────┘
    this.executingSequence  = false;
    this.executionIntent    = INTENT.NOT_SPECIFIED;

    //─────────────────────────────────────────────────────────────────────────┐
    // One final validation effort to make sure that we have all the info
    // that we expect/need in order to perform Demo Deployments and Validations.
    //─────────────────────────────────────────────────────────────────────────┘
    this.finalValidation();

    //─────────────────────────────────────────────────────────────────────────┐
    // It's very unlikely that we will need any of this, but for now I'm going
    // to keep references to the incoming object params using instance members.
    //─────────────────────────────────────────────────────────────────────────┘
    //this.sfdxProject            = sfdxProject;
    //this.sfdxProjectConfig      = sfdxProjectConfig;
    //this.localFalconConfigFile  = localFalconConfigFile;
    //this.demoBuildConfigFile    = demoBuildConfigFile;

    return;
  }
  //───────────────────────────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      resolve
   * @param       {string}  projectDirectory Required.
   *              Specifies the path of a local directory that contains the root of an ADK project.
   *              When not specified, the local SFDX project context must be present.
   * @param       {boolean} [debugMode] Optional.
   *              Set to TRUE to enable debug output from inside the AppxDemoProject object that this
   *              method will return.
   * @description Leverages the Project object from SFDX-Core to represent an SFDX project 
   *              directory.  This means that the directory must contain an sfdx-project.json file
   *              and (possibly) a hidden .sfdx folder that contains other local SFDX config files.
   * @version     1.0.0
   * @public @static @async 
   */
  //───────────────────────────────────────────────────────────────────────────────────────────────┘
  public static async resolve (projectDirectory: string, debugMode?:boolean) {

    //─────────────────────────────────────────────────────────────────────────┐
    // Activate debug mode if set to TRUE by the caller.
    //─────────────────────────────────────────────────────────────────────────┘
    debug.enabled = (debugMode === true);
    debugExtended.enabled = false;
    debug(`debug.enabled: ${debug.enabled}`);
    debug(`debugExtended.enabled: ${debugExtended.enabled}`);

    //─────────────────────────────────────────────────────────────────────────┐
    // Try to resolve an SFDX Project context using the project directory
    // that was passed in by the caller.
    //─────────────────────────────────────────────────────────────────────────┘
    // TODO: Add try/catch
    let sfdxProject = await core.SfdxProject.resolve(projectDirectory);
    debugExtended(`sfdxProject:\n%O`, sfdxProject);

    //─────────────────────────────────────────────────────────────────────────┐
    // Resolve the overall project config. A resolved config object will
    // contain a bunch of different properties from local and global
    // sfdx-project.json, aggregated config values, and (most importantly)
    // 3rd party custom properties like the ones for SFDX-Falcon.
    //─────────────────────────────────────────────────────────────────────────┘
    let sfdxProjectConfig = await sfdxProject.resolveProjectConfig();
    debugExtended(`sfdxProjectConfig:\n%O`, sfdxProjectConfig);

    //─────────────────────────────────────────────────────────────────────────┐
    // Try to get the local SFDX-Falcon Config File so we can parse it for 
    // settigns that belong to the local developer who is running this command.
    // To do this, we must first create a ConfigOptions object that points to
    // the sfdx-falcon-config.json file that should be found in the hidden
    // ".sfdx-falcon" directory at this project's root path.
    //─────────────────────────────────────────────────────────────────────────┘
    let falconLocalConfigOptions = {
      rootFolder: path.join(sfdxProject.getPath(), '.sfdx-falcon'),
      filename:   'sfdx-falcon-config.json',
      isGlobal:   false,
      isState:    false,
    }
    debugExtended(`fileConfigOptions:\n%O`, falconLocalConfigOptions);

    //─────────────────────────────────────────────────────────────────────────┐
    // Using the options set above, retrieve the SFDX-Falcon Config file, then
    // make sure that the file already exists on disk.
    //─────────────────────────────────────────────────────────────────────────┘
    let localFalconConfigFile = await core.ConfigFile.retrieve(falconLocalConfigOptions);

    if (await localFalconConfigFile.exists() === false) {
      let combinedPath = path.join(falconLocalConfigOptions.rootFolder, falconLocalConfigOptions.filename);
      throw new Error(`ERROR_CONFIG_NOT_FOUND: File does not exist - ${combinedPath}`);
    }
    debugExtended(`localFalconConfigFile: \n%O`, localFalconConfigFile);

    //─────────────────────────────────────────────────────────────────────────┐
    // Grab the JSON for "plugins.sfdxFalcon.appxDemo" from the resolved SFDX
    // Project Config object, then validate it to make sure all expected values
    // were provided.
    //─────────────────────────────────────────────────────────────────────────┘
    let appxDemoProjectConfig:AppxDemoProjectConfig = (sfdxProjectConfig as any).plugins.sfdxFalcon.appxDemo;
    let validationResponse = validateAppxDemoConfig(appxDemoProjectConfig);
    if (validationResponse !== true) {
      throw new Error(`ERROR_INVALID_CONFIG: Configuration for 'appxDemo' in sfdx-project.json has missing/invalid settings (${validationResponse}).`)
    }
    debugExtended(`appxDemoProjectConfig:\n%O`, appxDemoProjectConfig);

    //─────────────────────────────────────────────────────────────────────────┐
    // Try to get the DemoConfigJson file that (should be) referenced in the
    // appxDemoProjectConfig metadata.
    //─────────────────────────────────────────────────────────────────────────┘
    let demoBuildConfigOptions = {
      rootFolder: path.join(sfdxProject.getPath(), 'demo-config'),
      filename:   appxDemoProjectConfig.demoBuildConfig,
      isGlobal:   false,
      isState:    false,
    }
    debugExtended(`demoBuildConfigOptions:\n%O`, demoBuildConfigOptions);

    //─────────────────────────────────────────────────────────────────────────┐
    // Using the options set above, retrieve the Demo Build Config File file,
    // then make sure that the file already exists on disk.
    //─────────────────────────────────────────────────────────────────────────┘
    let demoBuildConfigFile = await core.ConfigFile.retrieve(demoBuildConfigOptions);

    if (await demoBuildConfigFile.exists() === false) {
      let combinedPath = path.join(demoBuildConfigOptions.rootFolder, demoBuildConfigOptions.filename);
      throw new Error(`ERROR_CONFIG_NOT_FOUND: File does not exist - ${combinedPath}`);
    }
    debugExtended(`demoBuildConfigFile: \n%O`, demoBuildConfigFile);

    //─────────────────────────────────────────────────────────────────────────┐
    // Construct a new AppxDemoProject object using the SFDX Project, SFDX Project
    // Config, and the SFDX-Falcon Config values.
    //─────────────────────────────────────────────────────────────────────────┘
    let newAdkProject = new AppxDemoProject(sfdxProject, sfdxProjectConfig, localFalconConfigFile, demoBuildConfigFile);

    //─────────────────────────────────────────────────────────────────────────┐
    // Done configuring the new AppxDemoProject object. Send it to the caller.
    //─────────────────────────────────────────────────────────────────────────┘
    return newAdkProject;

  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @function    deployDemo
   * @returns     {Promise<void>}  No return value, but may throw Errros.
   * @version     1.0.0
   * @description ????
   * @public @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  public async deployDemo() {

    // TODO: Implement this function. Copy from validateDemo()

  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @function      validateDemo
   * @returns       {Promise<FalconStatusReport>}  Resolves with a Falcon Status
   *                Report or bubbles up thrown errors.
   * @description   ????
   * @version       1.0.0
   * @public @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  public async validateDemo():Promise<FalconStatusReport> {

    // Use setIntent() to configure all member variables required by the intent.
    this.setIntent(INTENT.VALIDATE_DEMO);

    // This SFDX Command Sequence will provide our execution capabilities.
    let sfdxCommandSequence = new SfdxCommandSequence( this.demoBuildConfig,
                                                       this.projectPath,
                                                       this.devHubAlias,
                                                       this.targetOrgAlias);

    // TODO: Delete the old scratch org.

    // TODO: Create a new scratch org.

    // The Status Report returned here should
    let statusReport = await sfdxCommandSequence.execute();

    //─────────────────────────────────────────────────────────────────────────┐
    // ???
    //─────────────────────────────────────────────────────────────────────────┘
    return statusReport;

  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      finalValidation
   * @returns     {void}  No return value, but may throw Errros.
   * @description Goes through all of the member variables that are initialized
   *              by the constructor and checks each of them for validity and
   *              completeness.  Will throw an Error any time invalid or missing
   *              information is detected.
   * @version     1.0.0
   * @private
   */
  //───────────────────────────────────────────────────────────────────────────┘
  private finalValidation() {

    // TODO: Implement this function

    // DEVTEST
    //throw new Error('Hold your horses!');

  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      setIntent
   * @param       {INTENT}  intent  Required.  Enum indicating the caller's
   *                        intent when executing commands implemented by this
   *                        class.
   * @returns     {void}  No return value, but may throw Errros.
   * @description ???
   * @version     1.0.0
   * @private
   */
  //───────────────────────────────────────────────────────────────────────────┘
  private setIntent(intent:INTENT):void {

    // Make sure we're not already executing a command sequence.
    if (this.executingSequence === true) {
      throw new Error('ERROR_SEQUENCE_RUNNING: There is already another sequence running.')
    }
    else {
      this.executingSequence = true;
    }

    // Depending on the intent, set class member vars appropriately.
    switch(intent) {
      case INTENT.DEPLOY_DEMO:
        this.targetOrgAlias = this.demoDeploymentOrgAlias;
        break;
      case INTENT.HEALTH_CHECK:
        throw new Error(`ERROR_INTENT_NOT_IMPLEMENTED: Your command uses an intent that is not yet implemented.`);
        break;
      case INTENT.REPAIR_PROJECT:
        throw new Error(`ERROR_INTENT_NOT_IMPLEMENTED: Your command uses an intent that is not yet implemented.`);
        break;
      case INTENT.VALIDATE_DEMO:
        this.targetOrgAlias = this.demoValidationOrgAlias;
        break;
      default:
        throw new Error(`ERROR_UNKNOWN_INTENT: Your command did not specify a valid intent.`);
    }

    // Set the intent
    this.executionIntent  = intent;
  }
} // End of AppxDemoProject class definition.

// ────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @function    validateAppxDemoConfig
 * @param       {AppxDemoProjectConfig}  appxDemoConfig  ????
 * @returns     {boolean|Array<string>}  Returns TRUE if AppxDemoProjectConfig is valid. If not
 *                                       valid, returns an array of strings listing each key that
 *                                       had an invalid value.
 * @description ????
 * @version     1.0.0
 * @private
 */
// ────────────────────────────────────────────────────────────────────────────────────────────────┘
function validateAppxDemoConfig (appxDemoConfig:AppxDemoProjectConfig):boolean|Array<string> {
  let invalidConfigKeys = new Array<string>();

  if (! appxDemoConfig.demoAlias)       invalidConfigKeys.push('demoAlias');
  if (! appxDemoConfig.demoBuildConfig) invalidConfigKeys.push('demoBuildConfig');
  if (! appxDemoConfig.demoTitle)       invalidConfigKeys.push('demoTitle');
  if (! appxDemoConfig.demoType)        invalidConfigKeys.push('demoType');
  if (! appxDemoConfig.demoVersion)     invalidConfigKeys.push('demoVersion');
  if (! appxDemoConfig.gitHubUrl)       invalidConfigKeys.push('gitHubUrl');
  if (! appxDemoConfig.gitRemoteUri)    invalidConfigKeys.push('gitRemoteUri');
  if (! appxDemoConfig.partnerAlias)    invalidConfigKeys.push('partnerAlias');
  if (! appxDemoConfig.partnerName)     invalidConfigKeys.push('partnerName');
  if (! appxDemoConfig.schemaVersion)   invalidConfigKeys.push('schemaVersion');

  if (invalidConfigKeys.length > 0) {
    return invalidConfigKeys;
  }
  else {
    return true;
  }
}

// ────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @function    validateDemoBuildConfig
 * @param       {FalconCommandSequence}  demoBuildConfig  ????
 * @returns     {boolean|Array<string>}  Returns TRUE if demoBuildConfig is valid. If not valid,
 *                                       returns an array of strings listing each key that had an
 *                                       invalid value.
 * @version     1.0.0
 * @description ????
 * @private
 */
// ────────────────────────────────────────────────────────────────────────────────────────────────┘
export function validateDemoBuildConfig (demoBuildConfig:FalconCommandSequence):boolean|Array<string> {

  // TODO: Need to implement this function.

  let invalidConfigKeys = new Array<string>();

  //DEVTEST
  //invalidConfigKeys.push('test-error');
  //return invalidConfigKeys;

  return true;
}







/*
Example of appxDemo JSON:
"appxDemo": {
  "demoAlias"         : "MyAppxDemo",
  "demoConfigJson"    : "demo-config/demo-config.json",
  "demoTitle"         : "My AppExchange Demo",
  "demoType"          : "ADK-SINGLE",
  "demoVersion"       : "0.0.1",
  "gitHubUrl"         : "https://github.com/my-org/my-repo",
  "gitRemoteUri"      : "https://github.com/my-org/my-repo.git",
  "partnerAlias"      : "AppyInc",
  "partnerName"       : "Appy Apps Incorporated",
  "schemaVersion"     : "0.0.1"
}
//*/

// ────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @function    functionName
 * @param       {string}  requiredParameter Required. Description can continue onto multiple lines.
 * @param       {string}  [optionalParameter] Optional. Description can continue onto multiple lines.
 * @returns     {Promise<any>}  Resolves with ???, otherwise Rejects with ???.
 * @description ???
 * @version     1.0.0
 * @public @async
 */
// ────────────────────────────────────────────────────────────────────────────────────────────────┘
/*
private myFunction() {

}
//*/

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @function    functionName
   * @param       {string}  requiredParameter Required. Description can
   *                        continue onto multiple lines.
   * @param       {string}  [optionalParameter] Optional. Description can
   *                        continue onto multiple lines.
   * @returns     {Promise<any>}  Resolves with ???, otherwise Rejects with ???.
   * @description ???
   * @version     1.0.0
   * @public @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  /*
  private myFunction() {

  }
  //*/