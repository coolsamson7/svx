import pkg from '../../package.json';
import { DeclareLibrary, AbstractPackage } from '@svx/common';

@DeclareLibrary({ name: pkg.name, version: pkg.version })
export class SecurityCredentialsPackage extends AbstractPackage {}
