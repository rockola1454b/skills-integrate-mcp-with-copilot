document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupSubmit = document.getElementById("signup-submit");
  const emailInput = document.getElementById("email");
  const messageDiv = document.getElementById("message");
  const signupHint = document.getElementById("signup-form-hint");
  const teacherMenuToggle = document.getElementById("teacher-menu-toggle");
  const teacherAuthPanel = document.getElementById("teacher-auth-panel");
  const teacherLoginToggle = document.getElementById("teacher-login-toggle");
  const teacherLoginForm = document.getElementById("teacher-login-form");
  const teacherUsernameInput = document.getElementById("teacher-username");
  const teacherPasswordInput = document.getElementById("teacher-password");
  const authStatus = document.getElementById("auth-status");

  let teacherSession = null;
  let showLoginForm = false;

  function setMessage(text, type = "info") {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");

    clearTimeout(setMessage.timeoutId);
    setMessage.timeoutId = setTimeout(() => {
      messageDiv.classList.add("hidden");
      messageDiv.textContent = "";
    }, 5000);
  }

  function updateTeacherUI() {
    const isLoggedIn = Boolean(teacherSession);
    const shouldShowLogin = showLoginForm && !isLoggedIn;

    teacherLoginToggle.textContent = isLoggedIn ? "Log Out" : "Teacher Login";
    teacherLoginForm.classList.toggle("hidden", !shouldShowLogin);
    authStatus.textContent = isLoggedIn
      ? `Signed in as ${teacherSession.username}`
      : "Sign in as a teacher to manage registrations.";
    authStatus.classList.toggle("authenticated", isLoggedIn);

    signupSubmit.disabled = !isLoggedIn;
    emailInput.disabled = !isLoggedIn;
    activitySelect.disabled = !isLoggedIn;
    signupHint.textContent = isLoggedIn
      ? "You are signed in as a teacher and can update registrations."
      : "Teacher login is required to update participant lists.";
    signupHint.classList.toggle("active", isLoggedIn);
  }

  function getTeacherHeaders() {
    if (!teacherSession) {
      return {};
    }

    return {
      "X-Teacher-Username": teacherSession.username,
      "X-Teacher-Password": teacherSession.password,
    };
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;
        const canManage = Boolean(teacherSession);

        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        canManage
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: getTeacherHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!teacherSession) {
      setMessage("Please log in as a teacher to update registrations.", "error");
      return;
    }

    const email = emailInput.value;
    const activity = activitySelect.value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: getTeacherHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  teacherMenuToggle.addEventListener("click", () => {
    const willOpen = teacherAuthPanel.classList.contains("hidden");
    teacherAuthPanel.classList.toggle("hidden", !willOpen);
    teacherMenuToggle.setAttribute("aria-expanded", String(willOpen));
  });

  teacherLoginToggle.addEventListener("click", () => {
    if (teacherSession) {
      teacherSession = null;
      showLoginForm = false;
      teacherLoginForm.reset();
      updateTeacherUI();
      setMessage("Signed out.", "info");
      return;
    }

    showLoginForm = true;
    updateTeacherUI();
    teacherUsernameInput.focus();
  });

  teacherLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = teacherUsernameInput.value.trim();
    const password = teacherPasswordInput.value.trim();

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        teacherSession = { username, password };
        showLoginForm = false;
        teacherLoginForm.reset();
        updateTeacherUI();
        setMessage(result.message || "Signed in as a teacher.", "success");
      } else {
        setMessage(result.detail || "Login failed.", "error");
      }
    } catch (error) {
      setMessage("Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  updateTeacherUI();
  fetchActivities();
});
