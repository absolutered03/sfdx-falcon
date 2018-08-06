//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @file          modules/sfdx-falcon-recipe/index.ts
 * @copyright     Vivek M. Chawla - 2018
 * @author        Vivek M. Chawla <@VivekMChawla>
 * @version       1.0.0
 * @license       MIT
 * @requires      module:???
 * @summary       ???
 * @description   ???
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
import {SfdxCliLogLevel} from '../sfdx-falcon-types';           // Why?

export interface SfdxFalconRecipeContext {
  devHubAlias:        string;
  targetOrgAlias:     string;
  targetIsScratchOrg: boolean;
  projectPath:        string;
  configPath:         string;
  mdapiSourcePath:    string;
  dataPath:           string;
  logLevel:           SfdxCliLogLevel;
  recipeObserver:     any;
}
export interface SfdxFalconStepGroupContext extends SfdxFalconRecipeContext {
  stepGroupObserver:  any;
}



//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       SfdxFalconRecipe
 * @summary     ???
 * @description ???
 * @version     1.0.0
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
export class SfdxFalconRecipe {

  // Define read-only member variables.
  private _recipeName:string;                           // Why?
          get recipeName():string                       {return this._recipeName}
  private _description:string;                          // Why?
          get description():string                      {return this._description}
  private _recipeType:RecipeType;                       // Why?
          get recipeType():RecipeType                   {return this._recipeType}       
  private _recipeVersion:string;                        // Why?
          get recipeVersion():string                    {return this._recipeVersion}    
  private _schemaVersion:string;                        // Why?
          get schemaVersion():string                    {return this._schemaVersion}    
  private _options:RecipeOptions;                       // Why?
          get options():RecipeOptions                   {return this._options}          
  private _recipeStepGroups:Array<RecipeStepGroup>;     // Why?
          get recipeStepGroups():Array<RecipeStepGroup> {return this._recipeStepGroups} 
  private _handlers:string;                             // Why?
          get handlers():string                         {return this._handlers}         
  //private _xxxxxxxxxx:string;     // Why?
  //        get xxxxxxxxxx():string {return this._xxxxxxxxxx}

  // Define the substitution map

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      read
   * @param       {string}  recipePath  ???
   * @param       {string}  recipeFile  ???
   * @description ???
   * @version     1.0.0
   * @public @static @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  public static async read(recipePath:string, recipeFile:string):Promise<SfdxFalconRecipe> {

    // 1. Read file

    // 2. Try to convert to object via JSON.parse (looking for first failure here)

    // 3. Make sure to keep a string version  of the file.


    return null;
  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @constructs  SfdxFalconRecipe
   * @param       {any} xxxx ???? 
   * @param       {any} xxxx ???? 
   * @description ???
   * @version     1.0.0
   * @private
   */
  //───────────────────────────────────────────────────────────────────────────┘
  private constructor() {


  }

  //───────────────────────────────────────────────────────────────────────────┐
  /**
   * @method      compile
   * @param       ???
   * @description ???
   * @version     1.0.0
   * @public @async
   */
  //───────────────────────────────────────────────────────────────────────────┘
  public async compile():Promise<SfdxFalconRecipe> {

    return null;
  }







}

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       RecipeOptions
 * @summary     ???
 * @description ???
 * @version     1.0.0
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
class RecipeOptions {
  private _haltOnError:boolean;             // Why?
          get haltOnError():boolean         {return this._haltOnError}
  private _skipGroups:Array<string>;        // Why?
          get skipGroups():Array<string>    {return this._skipGroups}
  private _skipActions:Array<string>;       // Why?
          get skipActions():Array<string>   {return this._skipActions}
  private _targetOrgs:Array<TargetOrg>;     // Why?
          get targetOrgs():Array<TargetOrg> {return this._targetOrgs}

}

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       RecipeStepGroup
 * @summary     ???
 * @description ???
 * @version     1.0.0
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
class RecipeStepGroup {

}

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @enum        RecipeType
 * @summary     ???
 * @description ???
 * @version     1.0.0
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
enum RecipeType {
  APPX_DEMO     = 'appx-demo-recipe',
  APPX_PACKAGE  = 'appx-package-recipe'
}

//─────────────────────────────────────────────────────────────────────────────────────────────────┐
/**
 * @class       TargetOrg
 * @summary     ???
 * @description ???
 * @version     1.0.0
 * @public
 */
//─────────────────────────────────────────────────────────────────────────────────────────────────┘
class TargetOrg {
  private _xxxxxxxxxx:string;     // Why?
          get xxxxxxxxxx():string {return this._xxxxxxxxxx}
  
}


