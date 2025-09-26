const DEFAULT_POLICY = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecial: false,
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

  return policy;
}

export function getPasswordRequirementList(policy) {
  const requirements = [];

  if (policy.minLength && policy.minLength > 0) {
    requirements.push({
      id: "minLength",
      message: `At least ${policy.minLength} characters`,
    });
  }
  if (policy.requireUppercase) {
    requirements.push({
      id: "uppercase",
      message: "At least one uppercase letter",
    });
  }
  if (policy.requireLowercase) {
    requirements.push({
      id: "lowercase",
      message: "At least one lowercase letter",
    });
  }
  if (policy.requireNumber) {
    requirements.push({
      id: "number",
      message: "At least one number",
    });
  }
  if (policy.requireSpecial) {
    requirements.push({
      id: "special",
      message: "At least one symbol",
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

  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    failedRules.push({
      id: "uppercase",
      message: "Password must contain at least one uppercase letter.",
    });
  }

  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    failedRules.push({
      id: "lowercase",
      message: "Password must contain at least one lowercase letter.",
    });
  }

  if (policy.requireNumber && !/[0-9]/.test(password)) {
    failedRules.push({
      id: "number",
      message: "Password must contain at least one number.",
    });
  }

  if (policy.requireSpecial && !SPECIAL_CHAR_REGEX.test(password)) {
    failedRules.push({
      id: "special",
      message: "Password must contain at least one symbol.",
    });
  }

  return {
    valid: failedRules.length === 0,
    failedRules,
  };
}
