import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePersonalSuggestionsQuery } from "../../modules/checkupino/recommendations/api";

export default function PersonalSuggestions({
  articleId,
  language,
}: {
  readonly articleId: string;
  readonly language: "en" | "fa";
}) {
  const { t } = useTranslation();
  const result = usePersonalSuggestionsQuery(
    { articleId, language },
    {
      refetchOnMountOrArgChange: true,
      refetchOnFocus: true,
      pollingInterval: 60000,
      skipPollingIfUnfocused: true,
    },
  );
  const data = result.currentData;
  if (result.isFetching || result.isError || !data || data.state === "unavailable") return null;
  return (
    <section className="mt-4" aria-label={t("recommendationRules.forYou")}>
      <h6>{t("recommendationRules.forYou")}</h6>
      {data.state === "matched" ? (
        <ul className="list-unstyled">
          {data.items.map((item) => (
            <li className="mb-3" key={item.article.id}>
              <Link
                lang={item.article.content_language}
                dir={item.article.content_language === "fa" ? "rtl" : "ltr"}
                to={`/my/articles/${item.article.id}`}
              >
                {item.article.title}
              </Link>
              <p
                className="small text-muted mt-1"
                lang={item.explanation_language}
                dir={item.explanation_language === "fa" ? "rtl" : "ltr"}
              >
                {item.explanation}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small text-muted">
          {t(`recommendationRules.personalStates.${data.state}`)}{" "}
          {data.state === "insufficient_information" && (
            <Link to="/profile">{t("recommendationRules.profile")}</Link>
          )}
        </p>
      )}
    </section>
  );
}
