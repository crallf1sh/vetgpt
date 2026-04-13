const checkBtn = document.getElementById("checkBtn");
const resultBox = document.getElementById("resultBox");

// Toggle this later when your real backend is ready
const DEMO_MODE = true;

function getSelectedSymptoms() {
  return [...document.querySelectorAll('.checkbox-group input[type="checkbox"]:checked')]
    .map((checkbox) => checkbox.value);
}

function getFormData() {
  return {
    petName: document.getElementById("petName").value.trim(),
    petType: document.getElementById("petType").value,
    age: document.getElementById("age").value.trim(),
    symptoms: getSelectedSymptoms(),
    duration: document.getElementById("duration").value,
    notes: document.getElementById("notes").value.trim()
  };
}

function validateForm(data) {
  const errors = [];

  if (!data.petType) {
    errors.push("Please select whether your pet is a dog or cat.");
  }

  if (data.symptoms.length === 0) {
    errors.push("Please select at least one symptom.");
  }

  return errors;
}

function renderLoadingState(petName = "Your pet") {
  resultBox.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🩺</div>
      <p><strong>Reviewing ${petName}'s symptoms...</strong></p>
      <p class="muted">Please wait while VetGPT analyzes the information.</p>
    </div>
  `;
}

function renderValidationErrors(errors) {
  resultBox.innerHTML = `
    <div class="tag urgent">Needs More Info</div>
    <h3>Almost there</h3>
    <p><strong>Please fix the following:</strong></p>
    <ul class="muted">
      ${errors.map((error) => `<li>${error}</li>`).join("")}
    </ul>
  `;
}

function renderResult(data, petName = "Your pet") {
  const urgencyClass = data.urgency?.toLowerCase().includes("urgent") ? "urgent" : "monitor";

  resultBox.innerHTML = `
    <div class="tag ${urgencyClass}">${data.urgency || "Monitor"}</div>
    <h3>${petName}'s Symptom Review</h3>
    <p><strong>Possible concern:</strong> ${data.possibleConcern || "No concern provided."}</p>
    <p><strong>Recommended next step:</strong> ${data.recommendation || "No recommendation provided."}</p>
    <p class="muted">${data.disclaimer || "This is not a medical diagnosis."}</p>
  `;
}

function renderErrorState() {
  resultBox.innerHTML = `
    <div class="tag urgent">Error</div>
    <h3>Something went wrong</h3>
    <p><strong>We couldn’t complete the symptom review.</strong></p>
    <p>Please try again in a moment.</p>
    <p class="muted">This is a prototype and not a medical diagnosis.</p>
  `;
}

function getDemoResponse(formData) {
  const symptoms = formData.symptoms;
  const duration = formData.duration;
  const petType = formData.petType;
  const notes = formData.notes.toLowerCase();

  let response = {
    urgency: "Monitor",
    possibleConcern: "Mild symptoms were reported that may be related to a temporary issue.",
    recommendation: "Monitor symptoms closely and contact your veterinarian if symptoms continue or worsen.",
    disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
  };

  if (symptoms.includes("vomiting") && symptoms.includes("lethargy")) {
    response = {
      urgency: "Urgent Review Recommended",
      possibleConcern: `${petType === "cat" ? "These symptoms may suggest dehydration, stomach irritation, or another illness that can affect cats quickly." : "These symptoms may suggest dehydration, stomach irritation, or another illness that may need prompt attention."}`,
      recommendation: "Contact your veterinarian within 24 hours, especially if vomiting continues, your pet is not drinking, or energy levels continue to drop.",
      disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };
  }

  if (symptoms.includes("not-eating") && symptoms.includes("lethargy") && (duration === "3–5 days" || duration === "More than a week")) {
    response = {
      urgency: "Urgent Review Recommended",
      possibleConcern: "Loss of appetite combined with lethargy over several days may indicate a more serious issue.",
      recommendation: "A veterinary visit is recommended as soon as possible.",
      disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };
  }

  if (symptoms.includes("itching") && !symptoms.includes("lethargy") && !symptoms.includes("not-eating")) {
    response = {
      urgency: "Monitor",
      possibleConcern: "Itching may be related to skin irritation, allergies, fleas, or another minor issue.",
      recommendation: "Monitor for scratching, redness, or worsening discomfort. Schedule a vet visit if symptoms persist.",
      disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };
  }

  if (symptoms.includes("coughing") && petType === "dog") {
    response = {
      urgency: "Monitor",
      possibleConcern: "Coughing in dogs may be related to minor airway irritation, but persistent coughing should be reviewed.",
      recommendation: "Monitor the cough and contact your veterinarian if it becomes frequent, worsens, or affects energy levels.",
      disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };
  }

  if (notes.includes("not drinking") || notes.includes("trouble breathing") || notes.includes("collapsed")) {
    response = {
      urgency: "Urgent Review Recommended",
      possibleConcern: "The additional notes suggest symptoms that may require immediate veterinary attention.",
      recommendation: "Please contact an emergency veterinarian as soon as possible.",
      disclaimer: "This is not a medical diagnosis. Contact a licensed veterinarian for medical advice."
    };
  }

  return response;
}

function fetchDemoResponse(formData) {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(getDemoResponse(formData));
    }, 1400);
  });
}

async function submitSymptoms() {
  const formData = getFormData();
  const petName = formData.petName || "Your pet";
  const errors = validateForm(formData);

  if (errors.length > 0) {
    renderValidationErrors(errors);
    return;
  }

  renderLoadingState(petName);
  checkBtn.disabled = true;
  checkBtn.textContent = "Checking...";

  try {
    let data;

    if (DEMO_MODE) {
      data = await fetchDemoResponse(formData);
    } else {
      const response = await fetch("/api/check-symptoms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      data = await response.json();
    }

    renderResult(data, petName);
  } catch (error) {
    console.error("Symptom check failed:", error);
    renderErrorState();
  } finally {
    checkBtn.disabled = false;
    checkBtn.textContent = "Check Symptoms";
  }
}

checkBtn.addEventListener("click", submitSymptoms);