import fetch from "node-fetch";

export async function getWebAnnouncement() {
  const fetchURL = `${process.env.siteAddress}/api/announcement/get?announcementType=web`;
  try {
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    if (!response.ok) {
      // Handle the case where the API request is not successful, e.g., non-2xx status code.
      throw new Error(
        `Failed to fetch announcement data. Status: ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
        const responseText = await response.text();
        console.error("Error fetching announcement: Expected JSON response, but received:", responseText);
        throw new Error("Did not receive JSON response from API. Check siteAddress configuration.");
    }

    const apiData = await response.json();

    if (apiData.data && apiData.data.length > 0) {
      return apiData.data[0];
    } else {
      // Handle the case where there are no announcements.
      return null; // or return a default value as needed
    }
  } catch (error) {
    // Handle other potential errors such as network issues or JSON parsing errors.
    console.error("Error fetching announcement:", error);
    return null; // or throw an error, or handle it differently as needed
  }
}

export async function getPopupAnnouncements() {
  const fetchURL = `${process.env.siteAddress}/api/announcement/get?announcementType=popup`;
  try {
    const response = await fetch(fetchURL, {
      headers: { "x-access-token": process.env.apiKey },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch announcement data. Status: ${response.status}`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      const responseText = await response.text();
      console.error(
        "Error fetching popup announcement: Expected JSON response, but received:",
        responseText
      );
      throw new Error("Did not receive JSON response from API.");
    }

    const apiData = await response.json();

    if (apiData.data && apiData.data.length > 0) {
      return apiData.data;
    }

    return [];
  } catch (error) {
    console.error("Error fetching popup announcements:", error);
    return [];
  }
}
