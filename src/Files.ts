import * as fs from "fs";
import * as fse from "fs-extra";
import * as path from "path";
import {StringAndWidth, Strings} from "./utils";
import {Config, ProjectDetailsAndDirectory} from "./config";


export let loabanConfigName = 'laoban.json'
export let projectDetailsFile = 'project.details.json'

export function laobanFile(dir: string) { return path.join(dir, loabanConfigName)}

export function copyTemplateDirectory(config: Config, template: string, target: string): Promise<void> {
    return fse.copy(path.join(config.templateDir, template), target)
}
export function isProjectDirectory(directory: string) {
    return fs.existsSync(path.join(directory, projectDetailsFile))
}
export function findLaoban(directory: string) {
    let fullName = path.join(directory, loabanConfigName);
    if (fs.existsSync(fullName)) return directory
    let parse = path.parse(directory)
    if (parse.dir === parse.root) {throw Error('Cannot find laoban.json')}
    return findLaoban(parse.dir)
}

export class ProjectDetailFiles {


    // static workOutProjectDetails(root: string, all: boolean){
    //     if (all)  return this.findAndLoadProjectDetailsFromChildren(root);
    //
    //     this.loadProjectDetails(process.cwd()).then(pd=> {if (pd.projectDetails)))
    // }

    static findAndLoadSortedProjectDetails(root: string, all: boolean): Promise<ProjectDetailsAndDirectory[]> {
        let unsorted = all ? this.findAndLoadProjectDetailsFromChildren(root) : this.loadProjectDetails(process.cwd()).then(x => [x])
        return unsorted.then(raw => raw.sort((l, r) => {
            try { return l.projectDetails.projectDetails.generation - r.projectDetails.projectDetails.generation} catch (e) {return 0}
        }))
    }

    static findAndLoadProjectDetailsFromChildren(root: string): Promise<ProjectDetailsAndDirectory[]> {return Promise.all(this.findProjectDirectories(root).map(this.loadProjectDetails))}

    static loadProjectDetails(root: string): Promise<ProjectDetailsAndDirectory> {
        let rootAndFileName = path.join(root, projectDetailsFile);
        return new Promise<ProjectDetailsAndDirectory>((resolve) => {
            fs.readFile(rootAndFileName, (err, data) => {
                if (err) {resolve({directory: root})} else
                    resolve({directory: root, projectDetails: JSON.parse(data.toString())})
            })
        })
    }

    static findProjectDirectories(root: string): string[] {
        let rootAndFileName = path.join(root, projectDetailsFile);
        let result = fs.existsSync(rootAndFileName) ? [root] : []
        let children: string[][] = fs.readdirSync(root).map((file, index) => {
            if (file !== 'node_modules' && file !== '.git') {
                const curPath = path.join(root, file);
                if (fs.lstatSync(curPath).isDirectory())
                    return this.findProjectDirectories(curPath)
            }
            return []
        });
        return [].concat.apply(result, children)
    }
}


