import "reflect-metadata"

import { ConfigurationManager } from './configuration-manager';
import { ValueConfigurationSource } from './source';




describe("configuration manager", () => {
    // setup manager

    const createManager = async (): Promise<ConfigurationManager> => {
        const configurationManager = new ConfigurationManager(
            new ValueConfigurationSource({
                foo: {
                    bar: "bar",
                },
            }),
            new ValueConfigurationSource({
                foo: {
                    bar: "new bar",
                    baz: "baz",
                },
                bar: {
                    baz: "baz",
                },
            })
        )

        //container.register(ConfigurationManager, { useValue: configurationManager })

        await configurationManager.load()

        return configurationManager
    }

    it("should load values", async () => {
        const configurationManager = await createManager()
        let result = configurationManager.get("foo.bar")

        expect(result).toBe("new bar")

        result = configurationManager.get("dun.no", "foo")

        expect(result).toBe("foo")
    })
})
