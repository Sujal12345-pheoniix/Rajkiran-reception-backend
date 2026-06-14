// bmi calculation
export function calculateBmi(weight: number, height_cm: number): number {
  //height in cm
  return weight / ((height_cm / 100) * (height_cm / 100));
}

// bmr calculation
export function calculateBmr(
  weight: number,
  height_cm: number,
  age: number,
  gender: "male" | "female",
): number {
  if (gender === "male") {
    return 88.362 + 13.397 * weight + 4.799 * height_cm - 5.677 * age;
  } else {
    return 447.593 + 9.247 * weight + 3.098 * height_cm - 4.33 * age;
  }
}

// age calculation
export function calculateAge(birthDate: Date): number {
  const today = new Date();
  const age = today.getFullYear() - birthDate.getFullYear();
  return age;
}

export function generatePatientId(prefix: string = "PT"): string {
  // Year component (last 2 digits)
  const year = new Date().getFullYear().toString().slice(-2);

  // Month component
  const month = (new Date().getMonth() + 1).toString().padStart(2, "0");

  // Random alphanumeric (3-5 characters)
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const randomLength = Math.floor(Math.random() * 3) + 3; // 3-5 chars

  let random = "";
  for (let i = 0; i < randomLength; i++) {
    random += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Combine: PT + YYMM + RANDOM (total 6-8 chars without prefix)
  const id = `${year}${month}${random}`;

  // Ensure length 6-8
  return "PT" + id.slice(0, 8);
}
