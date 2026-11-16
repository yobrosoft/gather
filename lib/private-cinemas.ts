export type PrivateCinema = {
  id: string;
  operator: "Golden Village" | "Shaw Theatres" | "EagleWings Cinematics";
  name: string;
  address: string;
  lat: number;
  lng: number;
  seatsLabel: string;
  seatsMin: number | null;
  seatsMax: number | null;
  enquiryUrl: string;
  enquiryEmail: string;
  availability: string;
};

const gvPage = "https://www.gv.com.sg/GVGroupBookingsVenueHire";
const gvEmail = "sales@goldenvillage.com.sg";
const gvNote = "GV confirms a private hall only with a signed sales agreement. A public showtime means that session is already on sale, not that the hall is free.";

const shawPage = "https://shaw.sg/special-booking-terms";
const shawEmail = "sales@shaw.com.sg";
const shawNote = "Email Shaw the date, time, film, and headcount. An enquiry is not a booking until both sides sign the sales agreement.";

const eaglePage = "https://www.eaglewingscinematics.com.sg/corporate-booking";
const eagleEmail = "info@eaglewingscinematics.com.sg";
const eagleNote = "EagleWings takes private hall bookings, including faith-based group rates, by phone or email. There is no public availability calendar.";

export const PRIVATE_CINEMAS: PrivateCinema[] = [
  { id: "gv-bedok", operator: "Golden Village", name: "GV Bedok", address: "Bedok Mall, Singapore", lat: 1.324, lng: 103.929, seatsLabel: "Standard halls, about 78–114 seats", seatsMin: 78, seatsMax: 114, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-bishan", operator: "Golden Village", name: "GV Bishan", address: "Junction 8, Bishan, Singapore", lat: 1.3506, lng: 103.8486, seatsLabel: "Standard halls, about 139–249 seats", seatsMin: 139, seatsMax: 249, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-bugis", operator: "Golden Village", name: "GV Bugis+", address: "Bugis+, Singapore", lat: 1.2996, lng: 103.8554, seatsLabel: "Standard halls, about 142–318 seats", seatsMin: 142, seatsMax: 318, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-century", operator: "Golden Village", name: "GV Century Square", address: "Tampines Century Square, Singapore", lat: 1.3525, lng: 103.9404, seatsLabel: "Standard halls, about 102–110 seats", seatsMin: 102, seatsMax: 110, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-cineleisure", operator: "Golden Village", name: "GV Cineleisure", address: "8 Grange Road, Singapore", lat: 1.3016, lng: 103.8364, seatsLabel: "Standard halls, about 66–340 seats", seatsMin: 66, seatsMax: 340, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-citysquare", operator: "Golden Village", name: "GV City Square", address: "City Square Mall, Singapore", lat: 1.3114, lng: 103.8565, seatsLabel: "Standard halls, about 182–252 seats", seatsMin: 182, seatsMax: 252, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-funan", operator: "Golden Village", name: "GV Funan", address: "Funan, Singapore", lat: 1.2913, lng: 103.8499, seatsLabel: "Includes Gemini halls for smaller groups", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-greatworld", operator: "Golden Village", name: "GV Great World", address: "Great World, Singapore", lat: 1.2938, lng: 103.8318, seatsLabel: "Gold Class halls, about 30–48 seats", seatsMin: 30, seatsMax: 48, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-katong", operator: "Golden Village", name: "GV Katong", address: "Katong, Singapore", lat: 1.305, lng: 103.9047, seatsLabel: "Gold Class halls, about 24–32 seats", seatsMin: 24, seatsMax: 32, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-payalebar", operator: "Golden Village", name: "GV Paya Lebar", address: "SingPost Centre, Singapore", lat: 1.319, lng: 103.8938, seatsLabel: "Standard halls available for private hire", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-suntec", operator: "Golden Village", name: "GV Suntec City", address: "3 Temasek Boulevard, Singapore", lat: 1.2934, lng: 103.8574, seatsLabel: "Gold Class halls of about 32 seats, plus standard halls", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-tampines", operator: "Golden Village", name: "GV Tampines", address: "Tampines Mall, Singapore", lat: 1.3526, lng: 103.9447, seatsLabel: "Standard halls available for private hire", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-tiongbahru", operator: "Golden Village", name: "GV Tiong Bahru", address: "Tiong Bahru Plaza, Singapore", lat: 1.2864, lng: 103.8274, seatsLabel: "Standard halls available for private hire", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-vivo", operator: "Golden Village", name: "GV VivoCity", address: "VivoCity, Singapore", lat: 1.2644, lng: 103.8222, seatsLabel: "Gold Class halls, about 24–48 seats, plus standard halls", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "gv-yishun", operator: "Golden Village", name: "GV Yishun", address: "Yishun, Singapore", lat: 1.4294, lng: 103.8354, seatsLabel: "Standard halls available for private hire", seatsMin: null, seatsMax: null, enquiryUrl: gvPage, enquiryEmail: gvEmail, availability: gvNote },
  { id: "shaw-lido", operator: "Shaw Theatres", name: "Shaw Lido", address: "350 Orchard Road, Shaw House, Singapore", lat: 1.3055, lng: 103.8318, seatsLabel: "Includes IMAX, Lumière, and small premiere halls", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-jem", operator: "Shaw Theatres", name: "Shaw Jem", address: "50 Jurong Gateway Road, Singapore", lat: 1.3331, lng: 103.7436, seatsLabel: "Corporate and private hall hire", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-jewel", operator: "Shaw Theatres", name: "Shaw Jewel", address: "78 Airport Boulevard, Jewel, Singapore", lat: 1.3603, lng: 103.9895, seatsLabel: "Includes IMAX", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-plq", operator: "Shaw Theatres", name: "Shaw Paya Lebar Quarter", address: "10 Paya Lebar Road, Singapore", lat: 1.3174, lng: 103.8926, seatsLabel: "Includes IMAX", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-balestier", operator: "Shaw Theatres", name: "Shaw Balestier", address: "360 Balestier Road, Singapore", lat: 1.3256, lng: 103.8514, seatsLabel: "Corporate and private hall hire", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-waterway", operator: "Shaw Theatres", name: "Shaw Waterway Point", address: "83 Punggol Central, Singapore", lat: 1.4065, lng: 103.9022, seatsLabel: "Includes IMAX", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-nex", operator: "Shaw Theatres", name: "Shaw nex", address: "23 Serangoon Central, Singapore", lat: 1.3506, lng: 103.872, seatsLabel: "Corporate and private hall hire", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "shaw-lotone", operator: "Shaw Theatres", name: "Shaw Lot One", address: "21 Choa Chu Kang Avenue 4, Singapore", lat: 1.3854, lng: 103.7444, seatsLabel: "Corporate and private hall hire", seatsMin: null, seatsMax: null, enquiryUrl: shawPage, enquiryEmail: shawEmail, availability: shawNote },
  { id: "eagle-kap", operator: "EagleWings Cinematics", name: "EagleWings Cinematics", address: "9 King Albert Park, KAP Mall, Singapore", lat: 1.3354, lng: 103.7802, seatsLabel: "Private halls, including church group rates", seatsMin: null, seatsMax: null, enquiryUrl: eaglePage, enquiryEmail: eagleEmail, availability: eagleNote },
];

export function privateCinemaById(id: string): PrivateCinema | null {
  return PRIVATE_CINEMAS.find((cinema) => cinema.id === id) ?? null;
}

export type EnquiryMailRequest = {
  churchName: string;
  expectedHeadcount: number;
  preferredDates: string[];
  preferredTime: string;
  accessibilityNeeds: string;
  coordinatorName: string;
  coordinatorPhone: string;
  coordinatorEmail: string;
};

export function enquiryMailto(
  cinema: PrivateCinema,
  enquiry: { reference: string; mode: string; weekendKey: string },
  requests: EnquiryMailRequest[],
): string {
  const total = requests.reduce((sum, request) => sum + request.expectedHeadcount, 0);
  const lines = [
    `Enquiry ${enquiry.reference}`,
    "Film: The Chosen Crucifixion",
    `Cinema: ${cinema.name}`,
    `Request: ${enquiry.mode === "shared" ? "One shared screening" : "A private auditorium"}`,
    `Weekend of ${enquiry.weekendKey}`,
    `Estimated seats: ${total}`,
    "",
    ...requests.flatMap((request) => [
      `${request.churchName}: ${request.expectedHeadcount} guests`,
      `Preferred dates: ${request.preferredDates.join(", ")} at ${request.preferredTime}`,
      `Accessibility: ${request.accessibilityNeeds || "None stated"}`,
      `Coordinator: ${request.coordinatorName}, ${request.coordinatorPhone || "no phone"}, ${request.coordinatorEmail}`,
      "",
    ]),
    "Please tell us if a hall is free, the hall size, the hire cost, and whether we have screening rights.",
    "We understand an enquiry is not a confirmed booking.",
  ];
  const subject = `Screening enquiry ${enquiry.reference}: The Chosen Crucifixion, ${total} guests`;
  return `mailto:${cinema.enquiryEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

export function cinemaEnquiryMailto(cinema: PrivateCinema, details: { church: string; when: string; people: string; mode: string }): string {
  const subject = `Private screening enquiry: ${details.church}, ${details.when}`;
  const body = [
    `Church: ${details.church}`,
    `Cinema: ${cinema.name}`,
    `Film: The Chosen Crucifixion`,
    `When: ${details.when}`,
    `People expected: ${details.people}`,
    `Request: ${details.mode}`,
    "",
    "Please tell us if a hall is free, the hall size, and the hire cost.",
    "We understand an enquiry is not a confirmed booking.",
  ].join("\n");
  return `mailto:${cinema.enquiryEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
