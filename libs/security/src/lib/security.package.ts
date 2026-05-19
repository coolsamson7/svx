import pkg from '../../package.json'
import { DeclareLibrary, AbstractPackage } from '@svx/common'

@DeclareLibrary(pkg)
export class SecurityPackage extends AbstractPackage {}
