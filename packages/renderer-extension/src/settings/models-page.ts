import {
  harnessIdSchema,
  type HarnessInspectParams,
  type HarnessInspection,
  type HarnessModel,
} from "@codexhost/shared-contracts";

import { KNOWN_RENDERER_AGENTS, type ExternalRendererAgent } from "../agent-selection-state.js";
import { RENDERER_AGENT_LABELS } from "../renderer-agent-icon.js";
import {
  RENDERER_MODEL_VISIBILITY_CHANGED_EVENT,
  readHiddenModelIds,
  setExternalModelHidden,
} from "../renderer-model-visibility-preference.js";
import type { RendererSettingsPageDefinition, RendererSettingsPageMountContext } from "./core.js";
import type { RendererSettingsMessages } from "./localization.js";

export interface RendererModelCatalogClient {
  inspectHarness(params: HarnessInspectParams): Promise<HarnessInspection>;
}

const externalAgents = KNOWN_RENDERER_AGENTS.filter(
  (agent): agent is ExternalRendererAgent => agent !== "codex",
);

interface AgentCatalogResult {
  agent: ExternalRendererAgent;
  inspection: HarnessInspection | null;
  error: string | null;
}

function notifyVisibilityChanged(ownerDocument: Document): void {
  ownerDocument.defaultView?.dispatchEvent(
    new CustomEvent(RENDERER_MODEL_VISIBILITY_CHANGED_EVENT),
  );
}

function createModelRow(
  document: Document,
  agent: ExternalRendererAgent,
  model: HarnessModel,
  hidden: boolean,
): HTMLElement {
  const row = document.createElement("label");
  row.className = "settings-model-row";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = !hidden;
  checkbox.addEventListener("change", () => {
    setExternalModelHidden(agent, model.ref.id, !checkbox.checked);
    notifyVisibilityChanged(document);
  });
  const label = document.createElement("span");
  label.className = "settings-model-row__label";
  label.textContent = model.label;
  row.append(checkbox, label);
  if (model.resolvedModelLabel && model.resolvedModelLabel !== model.label) {
    const resolved = document.createElement("span");
    resolved.className = "settings-model-row__resolved";
    resolved.textContent = model.resolvedModelLabel;
    row.append(resolved);
  }
  return row;
}

function renderAgentGroup(
  document: Document,
  result: AgentCatalogResult,
  messages: RendererSettingsMessages,
): HTMLElement {
  const group = document.createElement("section");
  group.className = "settings-model-group";
  const heading = document.createElement("div");
  heading.className = "settings-section-label";
  heading.textContent = RENDERER_AGENT_LABELS[result.agent];
  group.append(heading);
  const inspection = result.inspection;
  if (!inspection || inspection.status !== "ready") {
    const status = document.createElement("p");
    status.className = "settings-page-description";
    status.textContent = result.error ?? messages.notAvailable;
    group.append(status);
    return group;
  }
  const models = inspection.catalog.models;
  if (models.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-page-description";
    empty.textContent = messages.modelsEmpty;
    group.append(empty);
    return group;
  }
  const hidden = readHiddenModelIds(result.agent);
  const list = document.createElement("div");
  list.className = "settings-model-list";
  for (const model of models) {
    list.append(createModelRow(document, result.agent, model, hidden.has(model.ref.id)));
  }
  group.append(list);
  return group;
}

export function createModelsSettingsPage(
  messages: RendererSettingsMessages,
  getModelClient: () => RendererModelCatalogClient | null,
): RendererSettingsPageDefinition {
  return Object.freeze({
    id: "models",
    label: messages.pageLabels.models,
    icon: "model-pool",
    mount(context: RendererSettingsPageMountContext) {
      const document = context.content.ownerDocument;
      const heading = document.createElement("div");
      heading.className = "settings-section-label";
      heading.textContent = messages.pageLabels.models;
      const description = document.createElement("p");
      description.className = "settings-page-description";
      description.textContent = messages.modelsDescription;
      const content = document.createElement("div");
      content.className = "settings-models-content";
      context.content.append(heading, description, content);

      const renderUnavailable = (text: string): void => {
        const empty = document.createElement("div");
        empty.className = "settings-empty";
        empty.textContent = text;
        content.replaceChildren(empty);
      };

      const render = (results: readonly AgentCatalogResult[]): void => {
        content.replaceChildren();
        for (const result of results) {
          content.append(renderAgentGroup(document, result, messages));
        }
      };

      const load = (): void => {
        const client = getModelClient();
        if (!client) {
          renderUnavailable(messages.runtimeCapabilityNotInstalled);
          return;
        }
        renderUnavailable(messages.modelsLoading);
        void context.runLatest(
          () =>
            Promise.all(
              externalAgents.map(async (agent): Promise<AgentCatalogResult> => {
                try {
                  const inspection = await client.inspectHarness({
                    harnessId: harnessIdSchema.parse(agent),
                  });
                  return { agent, inspection, error: null };
                } catch (error) {
                  return {
                    agent,
                    inspection: null,
                    error: error instanceof Error ? error.message : String(error),
                  };
                }
              }),
            ),
          {
            success(results) {
              render(results);
            },
            failure() {
              renderUnavailable(messages.modelsLoadFailed);
            },
          },
        );
      };

      load();
      return undefined;
    },
  });
}
