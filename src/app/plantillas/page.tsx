import { redirect } from "next/navigation";

export default function PlantillasPage({ searchParams }: { searchParams: { expediente?: string } }) {
  const id = searchParams.expediente;
  redirect(typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) ? `/expediente/${id}` : "/");
}
