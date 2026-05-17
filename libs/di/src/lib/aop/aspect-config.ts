import { AspectTarget } from "./aspect-target"
import { AspectType } from "./aspect-type.enum"

export interface AspectConfig {
    type: AspectType
    target?: AspectTarget
    order?: number
    enabledIf?: string
}
