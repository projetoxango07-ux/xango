"use client";
import { useParams } from "next/navigation";
import ModeloOrcamentoForm from "@/components/ModeloOrcamentoForm";
export default function EditarModeloOrcamentoPage(){const params=useParams();const p=Array.isArray(params.id)?params.id[0]:params.id;const id=Number(p);if(!Number.isInteger(id)||id<=0)return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">Modelo inválido.</div>;return <ModeloOrcamentoForm modeloId={id}/>;}
