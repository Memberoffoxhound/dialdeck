import { useState } from "react";
import {
  definePlugin,
  PanelSection,
  PanelSectionRow,
  TextField,
  ButtonItem,
  staticClasses
} from "@decky/ui";

export default definePlugin(() => {
  const [url, setUrl] = useState("https://localhost");

  return {
    title: <div className={staticClasses.Title}>Dialdeck</div>,
    content: (
      <PanelSection title="Party line">
        <PanelSectionRow>
          <TextField label="Dialdeck URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        </PanelSectionRow>
        <PanelSectionRow>
          <ButtonItem
            layout="below"
            onClick={() => {
              window.open(url, "_blank", "noopener");
            }}
          >
            Open Dialdeck
          </ButtonItem>
        </PanelSectionRow>
        <PanelSectionRow>
          Use the phone session for mic and this Deck session to watch. Publish 4K from desktop.
        </PanelSectionRow>
      </PanelSection>
    )
  };
});
