/**
 * a <code>ConfigurationSource</code> is a source for configuration values.
 */
export interface ConfigurationSource {
    /**
     * load the configuration values asynchronously and return the resulting tree
     */
    load(): Promise<any>
}
