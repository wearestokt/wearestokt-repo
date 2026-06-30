import { defineToolcraft } from "@/toolcraft/runtime";

/**
 * Flow Field — an art-directable vector-field graphic generator. The product
 * output is a still PNG of directional markers laid on a flow field, evoking
 * scientific ocean-current charts but fully art-directed. Canvas 2D custom
 * renderer; PNG/clipboard export; no animation/timeline/layers.
 */
export const appSchema = defineToolcraft({
  canvas: {
    enabled: true,
    renderScale: true,
    size: { height: 1080, unit: "px", width: 1920 },
    sizing: { mode: "editable-output" },
    upload: false,
  },
  export: {
    png: {
      background: "include",
    },
  },
  panels: {
    controls: {
      sections: [
        {
          controls: {
            pattern: {
              defaultValue: "currents",
              label: "Pattern",
              options: [
                { label: "Currents", value: "currents" },
                { label: "Vortex", value: "vortex" },
                { label: "Waves", value: "waves" },
                { label: "Turbulent", value: "turbulent" },
              ],
              orderRole: "mode",
              performanceReason:
                "Switching the field equation rebuilds the sampled vector field once per change.",
              performanceRole: "responsiveness",
              target: "flow.pattern",
              type: "select",
            },
            direction: {
              defaultValue: 200,
              label: "Direction",
              max: 360,
              min: 0,
              orderRole: "primary",
              performanceReason:
                "Rotates the base flow; cheap field resample on a fixed grid.",
              performanceRole: "responsiveness",
              step: 1,
              target: "flow.direction",
              type: "slider",
              unit: "°",
            },
            frequency: {
              defaultValue: 28,
              label: "Frequency",
              max: 100,
              min: 0,
              orderRole: "strength",
              performanceReason:
                "Scales noise feature size; cheap field resample on a fixed grid.",
              performanceRole: "responsiveness",
              step: 1,
              target: "flow.frequency",
              type: "slider",
            },
            swirl: {
              defaultValue: 30,
              label: "Swirl",
              max: 100,
              min: -100,
              orderRole: "strength",
              performanceReason:
                "Adds rotational bias; cheap field resample on a fixed grid.",
              performanceRole: "responsiveness",
              step: 1,
              target: "flow.swirl",
              type: "slider",
            },
            turbulence: {
              defaultValue: 24,
              label: "Turbulence",
              max: 100,
              min: 0,
              orderRole: "strength",
              performanceReason:
                "Adds noise distortion; cheap field resample on a fixed grid.",
              performanceRole: "responsiveness",
              step: 1,
              target: "flow.turbulence",
              type: "slider",
            },
          },
          title: "Flow Field",
        },
        {
          controls: {
            editMode: {
              defaultValue: false,
              description: "Draw and drag spline guides directly on the canvas.",
              label: "Edit guides",
              orderRole: "mode",
              performanceReason:
                "Enables the guide overlay for direct manipulation; does not resample the field.",
              performanceRole: "responsiveness",
              target: "guides.editMode",
              type: "switch",
            },
            maskUninfluenced: {
              defaultValue: false,
              description:
                "Hide markers outside guide reach. Use with splines for path-following flow instead of a full-canvas fill.",
              label: "Linear only",
              orderRole: "mode",
              performanceReason:
                "Culls glyphs outside guide reach; reduces draw count when enabled.",
              performanceRole: "responsiveness",
              target: "guides.maskUninfluenced",
              type: "switch",
            },
            influence: {
              defaultValue: 70,
              description: "How strongly nearby markers align to guide tangents.",
              label: "Influence",
              max: 100,
              min: 0,
              orderRole: "strength",
              performanceReason:
                "Blends guide tangents into the sampled field; resamples glyphs on change.",
              performanceRole: "responsiveness",
              step: 1,
              target: "guides.influence",
              type: "slider",
            },
            reach: {
              defaultValue: 30,
              description: "How far from a guide markers bend toward it.",
              label: "Reach",
              max: 100,
              min: 0,
              orderRole: "strength",
              performanceReason:
                "Scales guide proximity falloff; resamples glyphs on change.",
              performanceRole: "responsiveness",
              step: 1,
              target: "guides.reach",
              type: "slider",
            },
            addPath: {
              actions: [{ label: "Add path", value: "add-path" }],
              defaultValue: null,
              label: "Paths",
              orderRole: "advanced",
              performanceReason: "Creates a new empty guide path for canvas editing.",
              performanceRole: "responsiveness",
              target: "guides.addPath",
              type: "actions",
            },
            deletePath: {
              actions: [{ label: "Delete path", value: "delete-path" }],
              defaultValue: null,
              label: false,
              orderRole: "advanced",
              performanceReason: "Removes the active guide path.",
              performanceRole: "responsiveness",
              target: "guides.deletePath",
              type: "actions",
            },
          },
          layoutGroups: [
            {
              columns: 2,
              controls: ["editMode", "maskUninfluenced"],
              layout: "inline",
            },
            {
              columns: 2,
              controls: ["addPath", "deletePath"],
              layout: "inline",
            },
          ],
          title: "Flow Guides",
        },
        {
          controls: {
            density: {
              defaultValue: 22,
              label: "Density",
              max: 60,
              min: 6,
              orderRole: "primary",
              performanceReason:
                "Sets marker count along the short edge; the dominant renderer workload because it multiplies glyph draws.",
              performanceRole: "workload",
              step: 1,
              target: "field.density",
              type: "slider",
            },
            jitter: {
              defaultValue: 35,
              label: "Jitter",
              max: 100,
              min: 0,
              orderRole: "strength",
              performanceReason:
                "Offsets marker positions within their cell; per-cell math only.",
              performanceRole: "responsiveness",
              step: 1,
              target: "field.jitter",
              type: "slider",
            },
          },
          title: "Field Grid",
        },
        {
          controls: {
            style: {
              defaultValue: "wedge",
              label: "Style",
              options: [
                { label: "Wedge", value: "wedge" },
                { label: "Arrow", value: "arrow" },
                { label: "Line", value: "line" },
                { label: "Dart", value: "dart" },
              ],
              orderRole: "mode",
              performanceReason:
                "Chooses the glyph path; re-rasterizes existing field once.",
              performanceRole: "responsiveness",
              target: "marker.style",
              type: "select",
            },
            length: {
              defaultValue: 38,
              label: "Length",
              max: 80,
              min: 8,
              orderRole: "primary",
              performanceReason:
                "Marker length; re-rasterizes existing field without resampling.",
              performanceRole: "responsiveness",
              step: 1,
              target: "marker.length",
              type: "slider",
              unit: "px",
            },
            thickness: {
              defaultValue: 12,
              label: "Thickness",
              max: 30,
              min: 1,
              orderRole: "strength",
              performanceReason:
                "Marker thickness; re-rasterizes existing field without resampling.",
              performanceRole: "responsiveness",
              step: 1,
              target: "marker.thickness",
              type: "slider",
              unit: "px",
            },
            color: {
              defaultValue: { hex: "#FFFFFF", opacity: 100 },
              label: "Color",
              orderRole: "detail",
              performanceReason:
                "Marker fill color and opacity; re-rasterizes existing field.",
              performanceRole: "responsiveness",
              target: "marker.color",
              type: "colorOpacity",
            },
          },
          title: "Marker Style",
        },
        {
          controls: {
            includeBackground: {
              defaultValue: true,
              label: "Include",
              performanceReason:
                "Toggles whether the product background paints behind markers.",
              performanceRole: "responsiveness",
              target: "export.includeBackground",
              type: "switch",
            },
            background: {
              defaultValue: { hex: "#3B5BE0" },
              label: false,
              performanceReason:
                "Product background color; single fill before markers.",
              performanceRole: "responsiveness",
              target: "appearance.background",
              type: "color",
            },
          },
          layoutGroups: [
            {
              columns: 2,
              controls: ["includeBackground", "background"],
              layout: "inline",
            },
          ],
          title: "Background",
        },
        {
          controls: {
            imageFormat: {
              defaultValue: "png",
              label: "Format",
              options: [
                { label: "PNG", value: "png" },
                { label: "JPG", value: "jpg" },
                { label: "SVG", value: "svg" },
              ],
              performanceReason:
                "Chooses export encoding; affects export only, not preview.",
              performanceRole: "responsiveness",
              target: "export.image.format",
              type: "select",
            },
            imageResolution: {
              defaultValue: "4k",
              label: "Resolution",
              options: [
                { label: "2K", value: "2k" },
                { label: "4K", value: "4k" },
                { label: "8K", value: "8k" },
              ],
              performanceReason:
                "Sets export long-edge pixels; the workload that scales export-time rasterization up to 8192px.",
              performanceRole: "workload",
              target: "export.image.resolution",
              type: "select",
            },
          },
          layoutGroups: [
            {
              columns: 2,
              controls: ["imageFormat", "imageResolution"],
              layout: "inline",
            },
          ],
          title: "Image Export",
        },
        {
          controls: {
            actions: {
              actions: [
                {
                  icon: "download",
                  label: "Export PNG",
                  value: "export-png",
                  variant: "default",
                },
                {
                  icon: "copy",
                  label: "Copy PNG",
                  value: "copy-png",
                  variant: "secondary",
                },
              ],
              target: "panel.actions",
              type: "panelActions",
            },
          },
          title: "Export",
        },
      ],
      title: "Controls",
    },
  },
  persistence: { storage: "none" },
  toolbar: {
    history: true,
    radar: true,
    zoom: true,
  },
});
