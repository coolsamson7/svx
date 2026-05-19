import pkg from '../../package.json'
import { DeclareLibrary, AbstractPackage } from '@svx/common'

@DeclareLibrary(pkg)
export class ServiceNestjsPackage extends AbstractPackage {}
