import { ConfigurationSource } from "../configuration-source"

/**
 * <code>ValueConfigurationSource</code> is a simple source given a static value.
 */
export class ValueConfigurationSource implements ConfigurationSource {
    /**
     * create a new <code>ValueConfigurationSource</code>
     * @param value the value object
     */
    constructor(private value: any) {}

    // implement

    load(): Promise<any> {
        return Promise.resolve(this.value)
    }
}
