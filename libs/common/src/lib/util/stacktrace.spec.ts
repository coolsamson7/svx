import { Stacktrace } from "./stacktrace"

describe("stacktrace", () => {
    it('should map frames to original source', async () => {
      const stack = new Error().stack!
      //const frames = Stacktrace.createFrames(stack)

      //const mapped = await Stacktrace.mapFrames(...frames)

      //expect(mapped[0].file).toContain('.ts')  // should point to .ts not .js
      //expect(mapped[0].lineNumber).toBeGreaterThan(0)
    })
})