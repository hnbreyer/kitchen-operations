import Link from "next/link";
export default function RecipesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <nav aria-label="Recipes and menus" className="module-tabs">
        <Link href="/recipes">Recipe library</Link>
        <Link href="/recipes/ingredients">Ingredients</Link>
        <Link href="/recipes/templates">Menu templates</Link>
      </nav>
      {children}
    </>
  );
}
