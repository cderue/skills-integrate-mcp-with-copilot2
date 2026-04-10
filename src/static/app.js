document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const adminToggle = document.getElementById("admin-toggle");
  const adminPanel = document.getElementById("admin-panel");
  const adminLoginForm = document.getElementById("admin-login-form");
  const adminLogoutButton = document.getElementById("admin-logout");
  const adminStatus = document.getElementById("admin-status");
  const signupLockedMessage = document.getElementById("signup-locked-message");

  let authToken = localStorage.getItem("teacherAuthToken") || "";
  let teacherUsername = localStorage.getItem("teacherUsername") || "";

  function showMessage(message, type = "info") {
    messageDiv.textContent = message;
    messageDiv.className = type;
    messageDiv.classList.remove("hidden");

    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function updateAdminUI() {
    const isLoggedIn = Boolean(authToken);

    signupForm.classList.toggle("disabled", !isLoggedIn);
    signupLockedMessage.classList.toggle("hidden", isLoggedIn);

    if (isLoggedIn) {
      adminStatus.textContent = `Logged in as ${teacherUsername}`;
      adminLoginForm.classList.add("hidden");
      adminLogoutButton.classList.remove("hidden");
    } else {
      adminStatus.textContent = "Not logged in";
      adminLoginForm.classList.remove("hidden");
      adminLogoutButton.classList.add("hidden");
    }
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span><button class="delete-btn ${
                        authToken ? "" : "disabled"
                      }" data-activity="${name}" data-email="${email}" ${
                        authToken ? "" : "disabled"
                      }>❌</button></li>`
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
      document.querySelectorAll(".delete-btn:not(.disabled)").forEach((button) => {
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
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  async function loginTeacher(event) {
    event.preventDefault();

    const username = document.getElementById("admin-username").value.trim();
    const password = document.getElementById("admin-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (!response.ok) {
        showMessage(result.detail || "Login failed", "error");
        return;
      }

      authToken = result.token;
      teacherUsername = result.username;
      localStorage.setItem("teacherAuthToken", authToken);
      localStorage.setItem("teacherUsername", teacherUsername);
      adminLoginForm.reset();

      updateAdminUI();
      fetchActivities();
      showMessage(result.message, "success");
    } catch (error) {
      showMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  }

  async function logoutTeacher() {
    try {
      if (authToken) {
        await fetch("/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = "";
    teacherUsername = "";
    localStorage.removeItem("teacherAuthToken");
    localStorage.removeItem("teacherUsername");
    updateAdminUI();
    fetchActivities();
    showMessage("Logged out", "info");
  }

  async function restoreTeacherSession() {
    if (!authToken) {
      updateAdminUI();
      return;
    }

    try {
      const response = await fetch("/auth/status", {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
      const result = await response.json();

      if (!response.ok || !result.authenticated) {
        authToken = "";
        teacherUsername = "";
        localStorage.removeItem("teacherAuthToken");
        localStorage.removeItem("teacherUsername");
      } else {
        teacherUsername = result.username;
        localStorage.setItem("teacherUsername", teacherUsername);
      }
    } catch (error) {
      authToken = "";
      teacherUsername = "";
      localStorage.removeItem("teacherAuthToken");
      localStorage.removeItem("teacherUsername");
      console.error("Error restoring session:", error);
    }

    updateAdminUI();
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  adminToggle.addEventListener("click", () => {
    adminPanel.classList.toggle("hidden");
  });
  adminLoginForm.addEventListener("submit", loginTeacher);
  adminLogoutButton.addEventListener("click", logoutTeacher);

  // Initialize app
  restoreTeacherSession().then(fetchActivities);
});
