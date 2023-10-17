import fetch from "node-fetch";

/*
    
*/
export async function getWebAnnouncement() {
    const fetchURL = `${process.env.siteAddress}/api/announcement/get?announcementType=web`;
    const response = await fetch(fetchURL, {
        headers: { 'x-access-token': process.env.apiKey }
    });
    const apiData = await response.json();
    return apiData.data[0];
}