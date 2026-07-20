import { ToolcraftApp } from "@/toolcraft/runtime/react";

import { appSchema } from "../app/app-schema";
import { handleContainerYardPanelAction } from "../app/container-yard-panel-actions";
import { ContainerYardCanvas } from "../app/container-yard-renderer";

export function AppHome(): React.JSX.Element {
  return (
    <ToolcraftApp
      canvasContent={<ContainerYardCanvas />}
      className="h-dvh min-h-dvh"
      onPanelAction={handleContainerYardPanelAction}
      renderDefaultCanvasMedia={false}
      schema={appSchema}
    />
  );
}
