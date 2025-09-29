const DEFAULT_POLICY = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecial: true,
};

const SPECIAL_CHAR_REGEX = /[^\w\s]/;

export function getPasswordPolicy(config = {}) {
  const policyConfig =
    config?.auth?.passwordRequirements &&
    typeof config.auth.passwordRequirements === "object"
      ? config.auth.passwordRequirements
      : {};

  const policy = {
    ...DEFAULT_POLICY,
    ...policyConfig,
  };

  if (!Number.isFinite(policy.minLength) || policy.minLength < 0) {
    policy.minLength = DEFAULT_POLICY.minLength;
  } else {
    policy.minLength = Math.floor(policy.minLength);
  }

  policy.requireUppercase = Boolean(policy.requireUppercase);
  policy.requireLowercase = Boolean(policy.requireLowercase);
  policy.requireNumber = Boolean(policy.requireNumber);
  policy.requireSpecial = Boolean(policy.requireSpecial);
  policy.requireComplexity = Boolean(
    policy.requireUppercase ||
      policy.requireLowercase ||
      policy.requireNumber ||
      policy.requireSpecial
  );

  return policy;
}

export function getPasswordRequirementList(policy) {
  const requirements = [];

  if (policy.minLength && policy.minLength > 0) {
    requirements.push({
      id: "minLength",
      message: `Length: Aim for at least ${policy.minLength} characters, but longer is better.`,
    });
  }

  if (policy.requireComplexity) {
    requirements.push({
      id: "complexity",
      message:
        "Complexity: Include a mix of uppercase and lowercase letters, numbers, and special symbols.",
    });
  }

  return requirements;
}

export function validatePasswordAgainstPolicy(password, policy) {
  const failedRules = [];

  if (policy.minLength && password.length < policy.minLength) {
    failedRules.push({
      id: "minLength",
      message: `Password must be at least ${policy.minLength} characters long.`,
    });
  }

  if (policy.requireComplexity) {
    const missing = [];
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = SPECIAL_CHAR_REGEX.test(password);

    if (policy.requireUppercase && !hasUppercase) missing.push("uppercase letters");
    if (policy.requireLowercase && !hasLowercase) missing.push("lowercase letters");
    if (policy.requireNumber && !hasNumber) missing.push("numbers");
    if (policy.requireSpecial && !hasSpecial) missing.push("special symbols");

    if (missing.length) {
      let missingMessage = missing[0];
      if (missing.length === 2) {
        missingMessage = `${missing[0]} and ${missing[1]}`;
      } else if (missing.length > 2) {
        const tail = missing.pop();
        missingMessage = `${missing.join(", ")}, and ${tail}`;
      }
      failedRules.push({
        id: "complexity",
        message: `Password must include ${missingMessage}.`,
      });
    }
  }

  return {
    valid: failedRules.length === 0,
    failedRules,
  };
}
