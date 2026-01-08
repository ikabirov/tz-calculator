;(function () {
  "use strict"

  const STORAGE_KEY = "tz-calculator-timezones"
  let currentTimezones = []
  let currentTimestamp = Date.now()

  // Get all available IANA timezones from Intl API
  function getAvailableTimezones() {
    try {
      // Get all timezones supported by the browser
      const allTimezones = Intl.supportedValuesOf("timeZone")

      // Sort by continent and city
      allTimezones.sort((a, b) => a.localeCompare(b))

      return allTimezones.map((tz) => {
        const displayName = formatTimezoneDisplayName(tz)
        return {
          id: tz,
          name: displayName.city,
          fullName: tz,
        }
      })
    } catch (e) {
      alert("Intl.supportedValuesOf not supported")
    }
  }

  // Get timezone info (UTC offset)
  function getTimezoneInfo(timezoneId) {
    const now = new Date()

    // Get timezone offset in minutes
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneId,
      timeZoneName: "longOffset",
    })

    const parts = formatter.formatToParts(now)
    const offsetPart = parts.find((p) => p.type === "timeZoneName")

    if (offsetPart && offsetPart.value) {
      // Format is "GMT+XX:XX" or "GMT-XX:XX"
      const match = offsetPart.value.match(/GMT([+-])(\d{2}):(\d{2})/)
      if (match) {
        const sign = match[1]
        const hours = match[2]
        const minutes = match[3]

        // Format as UTC±HH:MM
        if (hours === "00" && minutes === "00") {
          return "UTC±00"
        }
        return `UTC${sign}${hours}:${minutes}`
      }
    }

    // Fallback: calculate offset manually
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }))
    const tzDate = new Date(
      now.toLocaleString("en-US", { timeZone: timezoneId })
    )
    const offsetMinutes = (tzDate - utcDate) / 60000

    const offsetHours = Math.abs(Math.floor(offsetMinutes / 60))
    const offsetMins = Math.abs(offsetMinutes % 60)
    const sign = offsetMinutes >= 0 ? "+" : "-"

    return `UTC${sign}${String(offsetHours).padStart(2, "0")}:${String(
      offsetMins
    ).padStart(2, "0")}`
  }

  // Format timezone display name
  function formatTimezoneDisplayName(timezoneId) {
    const match = timezoneId.match(/^(?<continent>[^/]+)\/(?<city>[^/]+)$/)
    if (match) {
      return {
        city: match.groups.city.replace(/_/g, " "),
        fullName: timezoneId,
      }
    }
    return {
      city: timezoneId,
      fullName: timezoneId,
    }
  }

  // Format datetime for input
  function formatDateTimeForInput(timestamp) {
    const date = new Date(timestamp)
    // Format: YYYY-MM-DDTHH:mm for datetime-local input
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const hours = String(date.getHours()).padStart(2, "0")
    const minutes = String(date.getMinutes()).padStart(2, "0")
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Parse datetime from input
  function parseDateTimeFromInput(dateTimeString, timezoneId) {
    // Create a date object from the input string
    const inputDate = new Date(dateTimeString)

    // Get the timezone's offset at this time
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneId,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })

    const parts = formatter.formatToParts(inputDate)
    const year = parseInt(parts.find((p) => p.type === "year").value)
    const month = parseInt(parts.find((p) => p.type === "month").value) - 1
    const day = parseInt(parts.find((p) => p.type === "day").value)
    const hour = parseInt(parts.find((p) => p.type === "hour").value)
    const minute = parseInt(parts.find((p) => p.type === "minute").value)
    const second = parseInt(parts.find((p) => p.type === "second").value)

    // Create date object treating the input as being in the specified timezone
    const localDate = new Date(year, month, day, hour, minute, second)

    // Convert to UTC timestamp by adjusting for the local timezone offset
    const utcTimestamp =
      localDate.getTime() + localDate.getTimezoneOffset() * 60000

    return utcTimestamp
  }

  // Format datetime for a specific timezone from timestamp (for datetime-local input)
  function formatDateTimeForTimezone(timestamp, timezoneId) {
    const date = new Date(timestamp)

    // Get the local time in target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneId,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })

    const parts = formatter.formatToParts(date)
    const year = parts.find((p) => p.type === "year").value
    const month = parts.find((p) => p.type === "month").value
    const day = parts.find((p) => p.type === "day").value
    const hour = parts.find((p) => p.type === "hour").value
    const minute = parts.find((p) => p.type === "minute").value

    // datetime-local expects format: YYYY-MM-DDTHH:mm
    return `${year}-${month}-${day}T${hour}:${minute}`
  }

  // Create a timezone card element
  function createTimezoneCard(timezoneId) {
    const displayName = formatTimezoneDisplayName(timezoneId)
    const utcOffset = getTimezoneInfo(timezoneId)
    const dateTimeStr = formatDateTimeForTimezone(currentTimestamp, timezoneId)

    const card = document.createElement("div")
    card.className = "timezone-card"
    card.dataset.timezoneId = timezoneId

    card.innerHTML = `
            <div class="card-header">
                <div class="timezone-info">
                    <b>${displayName.city}</b> (${utcOffset})
                </div>
                <button class="btn-remove" aria-label="Remove timezone" title="Remove">×</button>
            </div>
            <div class="card-datetime">
                <input type="datetime-local" class="datetime-input" value="${dateTimeStr}">
            </div>
        `

    // Add event listener for datetime changes
    const input = card.querySelector(".datetime-input")
    input.addEventListener("change", () =>
      handleDateTimeChange(timezoneId, input.value)
    )
    input.addEventListener("input", () =>
      handleDateTimeChange(timezoneId, input.value)
    )

    // Add event listener for remove button
    const removeBtn = card.querySelector(".btn-remove")
    removeBtn.addEventListener("click", () => removeTimezone(timezoneId))

    return card
  }

  // Handle datetime input change
  function handleDateTimeChange(timezoneId, dateTimeString) {
    // datetime-local gives us a date in browser's local timezone
    // We need to interpret this as being in the target timezone

    // Parse the datetime-local value (creates date in browser's local timezone)
    const inputDate = new Date(dateTimeString)

    // Get the date components as displayed in datetime-local (browser local time)
    const year = inputDate.getFullYear()
    const month = inputDate.getMonth()
    const day = inputDate.getDate()
    const hour = inputDate.getHours()
    const minute = inputDate.getMinutes()

    // Get the timezone offset for this specific date/time in the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezoneId,
      timeZoneName: "longOffset",
    })

    // Create a date object representing the input values
    const tempDate = new Date(year, month, day, hour, minute)
    const offsetParts = formatter.formatToParts(tempDate)
    const offsetPart = offsetParts.find((p) => p.type === "timeZoneName")

    let offsetMinutes = 0
    if (offsetPart && offsetPart.value) {
      const match = offsetPart.value.match(/GMT([+-])(\d{2}):(\d{2})/)
      if (match) {
        const sign = match[1] === "+" ? 1 : -1
        offsetMinutes = sign * (parseInt(match[2]) * 60 + parseInt(match[3]))
      }
    }

    // Calculate UTC timestamp: treat the input as being in target timezone
    // First create UTC date from the components, then subtract the timezone offset
    const utcDate = Date.UTC(year, month, day, hour, minute)
    currentTimestamp = utcDate - offsetMinutes * 60000

    // Update all other timezone inputs
    updateAllTimezoneInputs()
  }

  // Update all timezone inputs with current timestamp
  function updateAllTimezoneInputs() {
    const cards = document.querySelectorAll(".timezone-card")
    cards.forEach((card) => {
      const timezoneId = card.dataset.timezoneId
      const input = card.querySelector(".datetime-input")
      if (input && document.activeElement !== input) {
        input.value = formatDateTimeForTimezone(currentTimestamp, timezoneId)
      }
    })
  }

  // Add a timezone
  function addTimezone(timezoneId) {
    if (!timezoneId || currentTimezones.includes(timezoneId)) {
      return
    }

    currentTimezones.push(timezoneId)
    saveTimezones()
    renderTimezones()
  }

  // Remove a timezone
  function removeTimezone(timezoneId) {
    currentTimezones = currentTimezones.filter((tz) => tz !== timezoneId)
    saveTimezones()
    renderTimezones()
  }

  // Save timezones to localStorage
  function saveTimezones() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentTimezones))
    } catch (e) {
      console.warn("Failed to save to localStorage:", e)
    }
  }

  // Load timezones from localStorage
  function loadTimezones() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        return JSON.parse(stored)
      }
    } catch (e) {
      console.warn("Failed to load from localStorage:", e)
    }
    return null
  }

  // Render all timezone cards
  function renderTimezones() {
    const container = document.getElementById("timezone-cards")
    container.innerHTML = ""

    currentTimezones.forEach((timezoneId) => {
      const card = createTimezoneCard(timezoneId)
      container.appendChild(card)
    })

    updateAllTimezoneInputs()
  }

  // Populate timezone select dropdown with search filter
  function populateTimezoneSelect() {
    const select = document.getElementById("timezone-select")
    const searchInput = document.getElementById("timezone-search")
    const timezones = getAvailableTimezones()

    // Render timezones based on filter
    function renderTimezones(filter = "") {
      select.innerHTML = ""

      const filteredTimezones = timezones.filter((tz) => {
        const searchText = filter.toLowerCase()
        return (
          tz.name.toLowerCase().includes(searchText) ||
          tz.fullName.toLowerCase().includes(searchText)
        )
      })

      // Limit to 100 results for performance
      const limitedTimezones = filteredTimezones.slice(0, 100)

      limitedTimezones.forEach((tz) => {
        const option = document.createElement("option")
        option.value = tz.id
        option.textContent =
          tz.name + (tz.name !== tz.fullName ? ` (${tz.fullName})` : "")
        select.appendChild(option)
      })

      if (filteredTimezones.length > 100) {
        const option = document.createElement("option")
        option.disabled = true
        option.textContent = `... and ${
          filteredTimezones.length - 100
        } more (refine search)`
        select.appendChild(option)
      }
    }

    // Initial render
    renderTimezones()

    // Search filter handler
    searchInput.addEventListener("input", (e) => {
      renderTimezones(e.target.value)
    })

    // Add button click handler
    document.getElementById("add-btn").addEventListener("click", () => {
      const selectedTimezone = select.value
      if (selectedTimezone) {
        addTimezone(selectedTimezone)
        select.value = ""
        searchInput.value = ""
        renderTimezones()
      }
    })
  }

  // Initialize app
  function init() {
    // Load timezones from localStorage or initialize with current timezone
    const stored = loadTimezones()
    if (stored && stored.length > 0) {
      currentTimezones = stored
    } else {
      // Initialize with current timezone
      currentTimezones = [Intl.DateTimeFormat().resolvedOptions().timeZone]
      saveTimezones()
    }

    populateTimezoneSelect()
    renderTimezones()
  }

  // Start the app when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})()
