import { checkupinoApi, createCheckupinoApi } from "../query/api";
import { DEMO_QUESTIONNAIRE_SLUG } from "./definition";
import type {
  QuestionnaireDefinition,
  QuestionnaireResult,
  QuestionnaireSubmission,
} from "./definition";

export interface SavedQuestionnaireSummary {
  public_id: string;
  questionnaire_title: string;
  questionnaire_version: number;
  submitted_at: string | null;
  total_score: number;
  result_title: string | null;
}
export interface SavedQuestionnaire extends SavedQuestionnaireSummary {
  owner_id: number;
  answers_available: boolean;
  answers: { question_text: string | null; choice_text: string | null }[];
  result_body_html: string | null;
}

export const createQuestionnaireApi = (api: ReturnType<typeof createCheckupinoApi>) =>
  api.injectEndpoints({
    endpoints: (builder) => ({
      myQuestionnaireSubmissions: builder.query<
        {
          data: { owner_id: number; items: SavedQuestionnaireSummary[] };
          meta: { pagination: { current_page: number; last_page: number; total: number } };
        },
        number
      >({
        keepUnusedDataFor: 0,
        query: (page) => ({
          method: "GET",
          path: "/api/my/questionnaire-submissions",
          query: { page },
        }),
      }),
      myQuestionnaireSubmission: builder.query<{ data: SavedQuestionnaire }, string>({
        keepUnusedDataFor: 0,
        query: (id) => ({
          method: "GET",
          path: `/api/my/questionnaire-submissions/${encodeURIComponent(id)}`,
        }),
      }),
      demoQuestionnaire: builder.query<QuestionnaireDefinition, void>({
        keepUnusedDataFor: 0,
        query: () => ({ method: "GET", path: `/api/questionnaires/${DEMO_QUESTIONNAIRE_SLUG}` }),
      }),
      publishedQuestionnaires: builder.query<
        {
          data: { id: number; slug: string; title: string; questions_count: number }[];
          meta: { current_page: number; last_page: number; total: number };
        },
        number
      >({
        keepUnusedDataFor: 0,
        query: (page) => ({ method: "GET", path: "/api/questionnaires", query: { page } }),
      }),
      questionnaireDefinition: builder.query<QuestionnaireDefinition, string>({
        keepUnusedDataFor: 0,
        query: (slug) => ({
          method: "GET",
          path: `/api/questionnaires/${encodeURIComponent(slug)}`,
        }),
      }),
      submitDemoQuestionnaire: builder.mutation<
        QuestionnaireResult,
        QuestionnaireSubmission & { slug?: string }
      >({
        query: ({ answers, submitter_name, submitter_phone, slug = DEMO_QUESTIONNAIRE_SLUG }) => ({
          method: "POST",
          path: `/api/questionnaires/${encodeURIComponent(slug)}/submit`,
          body: {
            submitter_name,
            submitter_phone,
            answers: answers.map(({ question_id, choice_id }) => ({ question_id, choice_id })),
          },
        }),
      }),
    }),
  });

export const questionnaireApi = createQuestionnaireApi(checkupinoApi);
export const {
  useDemoQuestionnaireQuery,
  useSubmitDemoQuestionnaireMutation,
  usePublishedQuestionnairesQuery,
  useQuestionnaireDefinitionQuery,
  useMyQuestionnaireSubmissionsQuery,
  useMyQuestionnaireSubmissionQuery,
} = questionnaireApi;
