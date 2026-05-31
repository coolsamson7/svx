<script lang="ts">
  import type { UmlElement } from '../../model/types'

  let { data }: { data: { element: UmlElement } } = $props()
</script>

<div class="package-node">
  <div class="header">
    <span class="stereotype">«package»</span>
    <span class="name">{data.element.name}</span>
  </div>
</div>

<style>
  .package-node {
    width: 100%;
    height: 100%;
    background: rgba(240, 240, 255, 0.25);
    border: 2px dashed #7B74D0;
    border-radius: 8px;
    box-sizing: border-box;
    pointer-events: none;
  }
  .header {
    display: flex;
    flex-direction: column;
    padding: 6px 10px 5px;
    background: rgba(83, 74, 183, 0.08);
    border-bottom: 1px dashed #7B74D0;
    border-radius: 6px 6px 0 0;
    pointer-events: all;
    cursor: grab;
  }
  .stereotype {
    font-size: 9px;
    color: #534AB7;
    opacity: 0.8;
    font-style: italic;
    line-height: 1.2;
  }
  .name {
    font-size: 13px;
    font-weight: 700;
    color: #534AB7;
    line-height: 1.3;
  }
</style>
