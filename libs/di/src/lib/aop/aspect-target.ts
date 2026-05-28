import { MethodDescriptor, TypeDescriptor } from '@svx/common';
import { GType } from '@svx/common';


const subclassOf = (clazz: GType<any>, of: GType<any>): boolean => {
    while (clazz) {
        if (clazz === of) return true

        clazz = Object.getPrototypeOf(clazz)
    } // while

    return false
}

export class AspectTarget {
    // instance data

    private type: any

    private classDecorator: Function | undefined
    private methodDecorator: Function | undefined
    private names: string[] = []
    private expressions: RegExp[] = []
    private async: boolean | undefined
    private _order: number = 0

    // fluent interface

    named(...name: string[]): AspectTarget {
        this.names.push(...name)

        return this
    }

    matching(...expressions: string[]): AspectTarget {
        this.expressions.push(...expressions.map((expression) => new RegExp(expression)))

        return this
    }

    returning(type: GType<any>): AspectTarget {
        return this
    }

    thatAreAsync(): AspectTarget {
        this.async = true

        return this
    }

    thatAreSync(): AspectTarget {
        this.async = false

        return this
    }

    classDecoratedWith(decorator: Function): AspectTarget {
        this.classDecorator = decorator

        return this
    }

    decoratedWith(decorator: Function): AspectTarget {
        this.methodDecorator = decorator

        return this
    }

    of(type: GType<any>): AspectTarget {
        this.type = type

        return this
    }

    order(n: number): AspectTarget {
        this._order = n

        return this
    }

    getOrder(): number {
        return this._order
    }

    /** Returns the class declared via .of(), if any — used by the weaver to pre-filter candidates. */
    targetClass(): any {
        return this.type
    }

    // should not be public
    matchesMethod(type: TypeDescriptor<any>, method: MethodDescriptor): boolean {
        // check class — instance type must be the declared type or a subclass of it

        if (this.type && !subclassOf(type.type, this.type)) return false

        // class decorator

        if (this.classDecorator && !type.hasDecorator(this.classDecorator)) return false

        // method decorator

        if (this.methodDecorator && !method.hasDecorator(this.methodDecorator)) return false

        // method names

        if (this.names.length > 0 && !this.names.find((name) => name === method.name)) return false

        // regular expressions

        if (this.expressions.length > 0 && !this.expressions.find((expression) => expression.test(method.name))) return false

        // check sync / async

        if (this.async !== undefined && this.async !== method.async) return false

        // yipee

        return true
    }
}

export const methods = () => {
    return new AspectTarget()
}
