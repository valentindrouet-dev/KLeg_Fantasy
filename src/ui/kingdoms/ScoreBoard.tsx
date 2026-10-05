import { campaignStage, campaignSteps, computeScore, type Catalog, type CampaignStep } from "../../engine";
import { expansions } from "../../data/loadCards";
import { formatPlayTime, type Kingdom } from "../../persistence/kingdoms";
import { Dialog } from "../common/Dialog";
import { IconText } from "../common/IconText";
import styles from "./Kingdoms.module.css";

// Tableau des scores de la campagne d'un royaume (demande du 2026-10-05) : la partie de base, puis chaque extension,
// avec score (chemin de score), date de fin et temps de jeu. Un royaume n'est jamais clôturé : les grandes extensions
// à venir y figurent dès qu'elles sont déclarées dans data/expansions.json.

const dateFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

/** Statut d'un royaume pour l'accueil : il n'est jamais « terminé ». */
export function kingdomStatus(catalog: Catalog, k: Kingdom): { label: string; stage: string; play: string } {
  const stage = campaignStage(k.state, catalog);
  const current = campaignSteps(catalog, k.state).find((x) => x.status === "current" && x.kind !== "base");
  switch (stage) {
    case "base":
      return { label: "En cours", stage, play: "Continuer" };
    case "expansion":
      return { label: `${current?.name ?? "Extension"} · manche ${current?.round ?? 1}/4`, stage, play: "Continuer" };
    case "between":
      return { label: "Extension à lancer", stage, play: "Extensions" };
    case "waiting":
      return { label: "En attente de nouvelles extensions", stage, play: "Consulter" };
  }
}

function statusText(step: CampaignStep, baseDone: boolean): string {
  switch (step.status) {
    case "done":
      return "Terminée";
    case "current":
      return step.kind === "base" ? `En cours · manche ${step.round ?? 1}` : `En cours · manche ${step.round ?? 1}/4`;
    case "available":
      return "À jouer";
    case "upcoming":
      // Une seule extension à la fois : les autres attendent la fin de celle en cours.
      return baseDone ? "Après l'extension en cours" : "Après la partie de base";
  }
}

export function ScoreBoard({ catalog, kingdom, onClose }: { catalog: Catalog; kingdom: Kingdom; onClose: () => void }) {
  const steps = campaignSteps(catalog, kingdom.state);
  const milestones = kingdom.milestones ?? [];
  const at = (id: string) => milestones.find((m) => m.step === id);
  // Temps de jeu d'une étape : depuis la fin de l'étape précédente (si elle a un jalon), ou depuis le début.
  const done = steps.filter((x) => x.status === "done");
  const startOf = (step: CampaignStep): number | null => {
    const i = done.findIndex((x) => x.id === step.id);
    const prev = i < 0 ? done.at(-1) : done[i - 1];
    if (!prev) return 0;
    return at(prev.id)?.playMs ?? null;
  };
  const duration = (step: CampaignStep): string => {
    const start = startOf(step);
    const end = step.status === "done" ? at(step.id)?.playMs : step.status === "current" ? (kingdom.playMs ?? 0) : undefined;
    return start === null || end === undefined ? "—" : formatPlayTime(Math.max(0, end - start));
  };
  const score = computeScore(catalog, kingdom.state);
  // Extensions déclarées mais pas encore jouables dans l'appli (leurs cartes ou leurs règles manquent).
  const future = expansions.filter((e) => (e.kind === "grand" || e.kind === "custom") && !steps.some((x) => x.id === e.id));
  return (
    <Dialog title={`${kingdom.emoji} ${kingdom.name} : tableau des scores`} onClose={onClose} wide>
      <table className={styles.scoreBoard}>
        <thead>
          <tr>
            <th>Étape</th>
            <th>État</th>
            <th>Score</th>
            <th>Fin</th>
            <th>Temps de jeu</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((step) => {
            const m = at(step.id);
            return (
              <tr key={step.id} data-status={step.status}>
                <td>{step.name}</td>
                <td>{statusText(step, steps[0]?.status === "done")}</td>
                <td>{step.score === null ? "—" : <IconText text={`${step.score} {fame}`} />}</td>
                <td>{step.status === "done" ? (m ? dateFormat.format(m.at) : "non notée") : "—"}</td>
                <td>{step.status === "done" || step.status === "current" ? duration(step) : "—"}</td>
              </tr>
            );
          })}
          {future.map((e) => (
            <tr key={e.id} data-status="upcoming">
              <td>{e.name}</td>
              <td>À venir</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.scoreBoardFoot}>
        <IconText text={`Gloire actuelle : ${score.total} {fame}`} />
        {score.purgedFame > 0 && <IconText text={` · gloire purgée : ${score.purgedFame} {fame}`} />}
        {(kingdom.playMs ?? 0) > 0 && ` · temps de jeu total : ${formatPlayTime(kingdom.playMs ?? 0)}`}
      </p>
      {future.length === 0 && steps.every((x) => x.kind !== "grand") && <p className={styles.scoreBoardNote}>Les grandes extensions s'ajouteront ici quand leurs cartes seront disponibles : le royaume reste ouvert.</p>}
    </Dialog>
  );
}
