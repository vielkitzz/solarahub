interface ShirtIconProps {
  clubId?: string | null;
  number?: number;
  highlighted?: boolean;
  size?: string;
  isGK?: boolean;
}

const SHIRT_NUMBER_COLOR: Record<string, string> = {
  "263f38d8-b42e-48b3-a576-7a62da256fc3": "#1E1E1E", // Córdoba
  "3998bef5-9fc4-4955-87cd-a2b74db5daee": "white", // Luciérnaga
  "7946f9fa-3980-46fa-9960-11bb8bc705df": "#1E1E1E", // Córdoba
  "2220870b-284f-40e7-91d8-9cd099e774c4": "white", // Guarani
  "6892f878-cfd5-4401-a005-a4fdc0487da9": "#1E1E1E", // Defensor de Resistencia
  "adc0e083-bb36-4d2d-8d7c-522a8ddeebd7": "white", // Sporting Victoria
  "5ec6ff05-7c44-4527-b7a3-59af8551b06a": "white", // Boca del Trueno
  "ff480e44-d2d9-40b5-9c1a-8e17bf4b4693": "#CEA743", // San Cayetano de Tucumán
  "1d0e2e56-5a6f-4936-803e-597804d9cb2b": "#0D466F", // Atlético Solara
  "2d78c5bb-c4f1-4579-8bfd-7926ff3d86b4": "#CDBD93", // Reconquista de Santa Fé
  "c1f57bba-51be-43be-92ad-d46772e1fa80": "#D50007", // Santa Fé
  "5094e2aa-667a-4605-be3d-3189204e9fd5": "#7A0000", // Fluminense de La Plata
  "52b85950-bc55-457b-b7c0-08e06d3bb1e5": "white", // Avellaneda
  "6f158ccb-b28a-4eec-8e9f-5de393dc4963": "#E0002D", // Santa Rosa
  "23e6d6b9-694f-4f9f-a48f-312df9e13ddf": "#826251", // Neuquino
  "0a6fc153-3e05-417b-a3dd-f58d6a5df537": "#F6B81C", // Inter Celeste
  "6723383d-a0ce-4898-a282-9a52992f6059": "#1E1E1E", // Obrero
  "1c1c0505-e616-44c6-bee6-9f3fede79bff": "#FFBA28", // Bariloche Juniors
  "81f117bd-c6f1-41ea-acb3-8a6589502c23": "#0F1E47", // Paraná Misiones
  "6f6115ed-9263-4eb5-b93e-2932b93c799d": "#FFEDD6", // Unión del Sol
  "af124a12-4250-4831-9ef7-2b0d7b627135": "white", // Nacional de Solara
  "ebb127c1-a697-4c0e-a087-e5c2bd420092": "#1E1E1E", // Bragado
  "7cd6d74f-ed92-41c1-a806-21edd3f1573c": "white", // Puerto Iguazú
  "db58a853-7ce9-4fa0-90c3-f5f2a4a550c7": "#3B000D", // Luján de Cuyo
  "a9094295-2afc-42b7-8bb5-20231ca8ae1d": "white", // Deportes Frontera
  "ad5e98a4-0f75-47da-a73e-1ee811d879ef": "#D3BC8E", // Guaymallén
  "c47f92dd-2981-45fb-9905-d7df267b3f3c": "#C5222B", // Azaquilla
  "96dbcb80-0c42-4b5d-a774-59b5dc187f09": "white", // Sangre Chaqueña
  "bf6fe8d0-850a-435c-9ba2-da79653cd3be": "#DBAE53", // Rio Paraná
  "d3c0d1d0-6866-4eb4-b410-f1966d889f20": "white", // Catamarca
  // adicione os outros clubes aqui
};

export function ShirtIcon({ clubId, number, highlighted, size = "w-8 h-8", isGK = false }: ShirtIconProps) {
  const src = isGK ? "/kits/gk-shirt.svg" : clubId ? `/kits/${clubId}.svg` : "/placeholder.svg";
  const numberColor = isGK ? "white" : (clubId && SHIRT_NUMBER_COLOR[clubId]) || "white";

  return (
    <div className={`relative ${size}`}>
      <img
        src={src}
        alt="Camisa"
        className={`w-full h-full object-contain transition-all duration-300 ${
          highlighted ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""
        }`}
      />
      {number != null && (
        <span
          className="absolute inset-0 flex items-center justify-center"
          style={{
            fontSize: "clamp(14px, 70%, 32px)",
            color: numberColor,
            paddingBottom: "15%",
            zIndex: 10,
            fontFamily: "'Vina Sans', sans-serif",
          }}
        >
          {number}
        </span>
      )}
    </div>
  );
}
