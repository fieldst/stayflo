import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const property = String(form.get("property") || "").trim();
    const file = form.get("file") as File | null;

    if (!property) {
      return NextResponse.json({ error: "Missing property" }, { status: 400 });
    }

    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files allowed" }, { status: 400 });
    }

    const fileName = file.name || "guest-guide.pdf";
    const filePath = `${property}/guest-guide.pdf`;

    // 1) Upload / replace PDF in storage
    const { error: uploadError } = await supabaseServer.storage
      .from("host-guides")
      .upload(filePath, file, {
        upsert: true,
        contentType: "application/pdf",
      });

    if (uploadError) throw uploadError;

    // 2) Upsert DB record (replace row if property already exists)
    const { error: dbErr } = await supabaseServer
      .from("property_guides")
      .upsert(
        {
          property_slug: property,
          file_path: filePath,
          file_name: fileName,
          uploaded_at: new Date().toISOString(),
        },
        { onConflict: "property_slug" }
      );

    if (dbErr) throw dbErr;

    return NextResponse.json(
      {
        success: true,
        property,
        file: fileName,
        filePath,
      },
      { status: 200 }
    );
  } catch (e: any) {
    console.error("Guide upload failed:", e);
    return NextResponse.json({ error: e?.message || "Upload failed" }, { status: 500 });
  }
}