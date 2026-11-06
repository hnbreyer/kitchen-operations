"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="panel placeholder" role="alert">
      <h1>Unable to load this page</h1>
      <p>
        Check the database connection and apply the setup migrations, then try
        again.
      </p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
