import { faker } from "@faker-js/faker";

// Faker's portraits are AI-generated (Stable Diffusion 3) and public domain.
// Never faker.image.avatar(): it mixes in real GitHub users' pictures. The set
// has 100 per sex across all ages; these look like students and were
// generated for age 35 or under (each portrait's metadata has its prompt).
const STUDENT_PORTRAITS = {
  female: [
    0, 1, 3, 8, 17, 28, 36, 40, 42, 43, 44, 45, 47, 50, 56, 57, 58, 60, 64, 65,
    66, 68, 72, 82, 84, 87, 88, 89, 90, 91, 92, 94, 97, 98,
  ],
  male: [
    4, 5, 7, 12, 18, 21, 27, 32, 34, 37, 45, 46, 48, 49, 51, 58, 63, 66, 70, 71,
    72, 74, 76, 78, 83, 87, 88, 91, 97, 98,
  ],
};

export type Sex = "female" | "male";

export function portraitUrl(sex: Sex, n: number) {
  return `https://cdn.jsdelivr.net/gh/faker-js/assets-person-portrait/${sex}/256/${n}.jpg`;
}

// Hands out each portrait at most once; null when that sex has run out.
export function portraitPicker() {
  const left = {
    female: faker.helpers.shuffle([...STUDENT_PORTRAITS.female]),
    male: faker.helpers.shuffle([...STUDENT_PORTRAITS.male]),
  };
  return (sex: Sex) => {
    const n = left[sex].pop();
    return n === undefined ? null : portraitUrl(sex, n);
  };
}
