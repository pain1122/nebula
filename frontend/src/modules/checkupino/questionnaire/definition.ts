export const DEMO_QUESTIONNAIRE_SLUG = "demo-heart-health-screen";

export interface QuestionnaireDefinition {
  readonly id: number;
  readonly slug: string;
  readonly version: number;
  readonly title: string;
  readonly content_html: string | null;
  readonly questions: readonly {
    readonly id: number;
    readonly text: string;
    readonly sort_order: number;
    readonly choices: readonly {
      readonly id: number;
      readonly text: string;
      readonly sort_order: number;
    }[];
  }[];
}

export interface QuestionnaireResult {
  readonly submission_id: string;
  readonly total_score: number;
  readonly recommendation: { readonly title: string; readonly body_html: string } | null;
}

export interface QuestionnaireSubmission {
  readonly submitter_name: string;
  readonly submitter_phone: string;
  readonly answers: readonly { readonly question_id: number; readonly choice_id: number }[];
}

// Only rendered as React text. A detached template is inert and never enters the document.
export const questionnaireText = (html: string | null): string => {
  const template = document.createElement("template");
  template.innerHTML = (html ?? "").slice(0, 100000);
  template.content
    .querySelectorAll("script,style,iframe,object,embed,template")
    .forEach((node) => node.remove());
  template.content.querySelectorAll("br").forEach((node) => node.replaceWith("\n"));
  template.content
    .querySelectorAll("p,li,h1,h2,h3,h4,h5,h6,div")
    .forEach((node) => node.append("\n"));
  return template.content.textContent?.trim() ?? "";
};

export const definitionFingerprint = (definition: QuestionnaireDefinition) =>
  JSON.stringify([
    definition.id,
    definition.slug,
    definition.version,
    definition.title,
    definition.content_html,
    definition.questions,
  ]);

export const completeAnswers = (
  definition: QuestionnaireDefinition,
  selected: Readonly<Record<number, number>>,
) =>
  definition.slug === DEMO_QUESTIONNAIRE_SLUG &&
  Number.isSafeInteger(definition.version) &&
  definition.version > 0 &&
  definition.questions.length > 0 &&
  definition.questions.length <= 100 &&
  new Set(definition.questions.map((question) => question.id)).size ===
    definition.questions.length &&
  definition.questions.every(
    (question) =>
      Number.isSafeInteger(question.id) &&
      question.id > 0 &&
      question.choices.some((choice) => choice.id === selected[question.id]),
  );

const aliases: Readonly<Record<string, string>> = {
  "Demo Heart Health Screen": "questionnaire.demo.title",
  "This demo is informational and does not replace medical advice.":
    "questionnaire.demo.description",
  "Do you experience chest discomfort during activity?": "questionnaire.demo.chest",
  "Do you become unusually short of breath during normal activity?": "questionnaire.demo.breath",
  "Do you have a family history of early heart disease?": "questionnaire.demo.family",
  Never: "questionnaire.demo.never",
  Sometimes: "questionnaire.demo.sometimes",
  Often: "questionnaire.demo.often",
  No: "questionnaire.demo.no",
  Unsure: "questionnaire.demo.unsure",
  Yes: "questionnaire.demo.yes",
  "Continue routine prevention": "questionnaire.demo.routineTitle",
  "Maintain routine preventive care.": "questionnaire.demo.routineBody",
  "Consider a medical consultation": "questionnaire.demo.consultTitle",
  "Consider discussing these symptoms with a doctor.": "questionnaire.demo.consultBody",
  "Arrange prompt medical advice": "questionnaire.demo.promptTitle",
  "Arrange prompt medical advice. Seek emergency care for severe symptoms.":
    "questionnaire.demo.promptBody",
};

export const demoTranslationKey = (definition: QuestionnaireDefinition, text: string) =>
  definition.slug === DEMO_QUESTIONNAIRE_SLUG && definition.version === 1
    ? aliases[text]
    : undefined;
