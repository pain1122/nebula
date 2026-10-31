import { ErrorState, LoadingState } from "../../modules/checkupino/feedback";
import type { ProductLocale } from "../../modules/checkupino/preferences/localization";

interface LoaderProps {
  readonly error?: unknown;
  readonly locale?: ProductLocale;
}

const Loader = ({ error, locale = "fa" }: LoaderProps) =>
  error === undefined ? (
    <LoadingState className="justify-content-center mx-2 mt-2" locale={locale} />
  ) : (
    <ErrorState className="mx-2 mt-2" error={error} locale={locale} />
  );

export default Loader;
