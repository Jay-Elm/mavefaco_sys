// Upper bounds for free-text input. Generous for real use; they exist to
// stop multi-megabyte names, messages or reviews from being stored and
// rendered, not to constrain normal content.
export const MAX = {
  name: 100,
  email: 254, // RFC 5321 address limit
  newPassword: 128, // bcrypt only reads the first 72 bytes; this bounds hashing work
  password: 1024, // login/current password: never lock out an existing longer password
  token: 256,
  url: 2048,
  productName: 120,
  productDescription: 2000,
  unit: 30,
  category: 60,
  message: 2000,
  review: 1000,
  cropNote: 1000,
  announcementTitle: 150,
  announcementBody: 5000,
  bannerTitle: 120,
  bannerSubtitle: 250,
  bannerCtaText: 40,
  faqQuestion: 300,
  faqAnswer: 3000,
  siteShort: 300,
  siteLong: 5000,
} as const;

export const tooLong = (field: string, max: number) => `${field} must be at most ${max} characters`;
