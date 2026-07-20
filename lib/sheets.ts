import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

// Fungsi pembantu untuk membersihkan format private key
const formatPrivateKey = (key?: string) => {
  if (!key) return undefined;
  // Menghapus tanda kutip ekstra di awal/akhir dan mem-parsing \n menjadi newline sungguhan
  return key.replace(/^"|"$/g, '').replace(/\\n/g, '\n');
};

// Inisialisasi Auth
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY),
  },
  scopes: SCOPES,
});

const sheets = google.sheets({ version: "v4", auth });
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = "Form responses 1";

export type CustomerSheetData = {
  dbId: string; // ID unik dari database Prisma untuk referensi edit
  timestamp: string;
  namaPelanggan: string;
  namaPic: string;
  nomorHpPic: string;
  nomorUser: string;
  alamat: string;
  kategori: string;
  hotda: string;
  status: string;
};

export async function syncToSpreadsheet(data: CustomerSheetData) {
  try {
    const rowValues = [
      data.timestamp,
      data.namaPelanggan,
      data.namaPic,
      data.nomorHpPic,
      data.nomorUser,
      data.alamat,
      data.kategori,
      data.hotda,
      data.status,
      data.dbId, // Kolom J: ID unik (bisa di-hide di spreadsheet)
    ];

    // 1. Ambil semua data untuk mengecek apakah ID sudah ada (untuk Edit)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:J`,
    });

    const rows = response.data.values || [];
    
    // Cari baris yang memiliki dbId yang sama (kolom indeks ke-9)
    const rowIndex = rows.findIndex((row) => row[9] === data.dbId);

 // ... kode bagian atas tetap sama ...

    if (rowIndex !== -1) {
      // JIKA DATA ADA -> UPDATE BARIS TERSEBUT
      const range = `${SHEET_NAME}!A${rowIndex + 1}:J${rowIndex + 1}`;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowValues],
        },
      });
      console.log("Data Spreadsheet diupdate pada baris:", rowIndex + 1);
      
    } else {
      // JIKA DATA TIDAK ADA -> TAMBAH BARIS BARU DI BAWAH (KRONOLOGIS)
      // Cari baris terakhir yang terisi berdasarkan kolom pertama (timestamp)
      const lastFilledRowIndex = rows.reduce((lastIdx, row, idx) => {
        return (row[0] && row[0].toString().trim() !== "") ? idx : lastIdx;
      }, 0);
      
      const newRowIndex = lastFilledRowIndex + 2; // +1 untuk 1-based sheet row, +1 untuk baris berikutnya
      const range = `${SHEET_NAME}!A${newRowIndex}:J${newRowIndex}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [rowValues],
        },
      });
      console.log("Data baru ditambahkan ke Spreadsheet pada baris:", newRowIndex);
    }

// ... kode bagian bawah tetap sama ...
  } catch (error) {
    console.error("Gagal sinkronisasi ke Spreadsheet:", error);
    throw new Error("Gagal menyimpan ke Spreadsheet");
  }
}

export async function deleteFromSpreadsheet(dbId: string) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });
    
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
    const sheetId = sheet?.properties?.sheetId || 0;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:J`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[9] === dbId);

    if (rowIndex !== -1) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: sheetId,
                  dimension: "ROWS",
                  startIndex: rowIndex,
                  endIndex: rowIndex + 1,
                }
              }
            }
          ]
        }
      });
      console.log("Baris berhasil dihapus dari Spreadsheet pada indeks:", rowIndex);
      return true;
    }
    return false;
  } catch (error) {
    console.error("Gagal menghapus dari Spreadsheet:", error);
    return false;
  }
}