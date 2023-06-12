import React from "react";
import DropdownMenu from "./DropdownMenu.jsx";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import {useEffect, useRef, useState} from "react";
import {db} from "../firebase";
import "../styles/VideoCallPage.css";
import JoinButton from "./buttons/JoinButton.jsx";

import {
    collection,
    doc,
    onSnapshot,
    getDoc,
    updateDoc,
    addDoc,
} from "firebase/firestore";
import {useSelector} from "react-redux";
import {styled} from "@mui/material";

const VideoContainer = styled(Box)(({theme}) => ({
    width: "100%",
    textAlign: "center",

    [theme.breakpoints.up("md")]: {
        height: "100%",
        maxHeight: "100%",
    },
    [theme.breakpoints.down("md")]: {
        height: "49vh",
        maxHeight: "49vh",
    },
}));

const VideoItem = styled(Box)(({theme}) => ({
    objectFit: "cover",
    borderRadius: 5,
    width: "100%",
    height: "100vh",
    maxHeight: "100%",
    maxWidth: "100%",
    backgroundColor: "#0A0A0A",
}));

/**
 * Video Calling Page using WebRTC
 * @returns {JSX.Element}
 * @constructor
 */
function VideoCallPage() {
    const webcamVideo = useRef(null);
    const remoteVideo = useRef(null);
    const [joinedCall, setJoinedCall] = useState(false);

    const currentUser = useSelector((state) => state.login.user);
    let localStream = null;
    let remoteStream = null;
    let candidatesQueue = [];

    // server config
    const servers = {
        iceServers: [
            {
                urls: [
                    "stun:stun1.l.google.com:19302",
                    "stun:stun2.l.google.com:19302",
                ], // free stun server
            },
        ],
        iceCandidatePoolSize: 10,
    };
    const [pc, setPc] = useState(new RTCPeerConnection(servers));

    useEffect(() => {
        console.log("Peer Connection Created");
        startWebCam();
    }, []);

    /**
     * Stops the webcam
     */
    const stopWebCam = async () => {
        let localStream = webcamVideo.current.srcObject;
        console.log(localStream);
        if (localStream) {
            localStream.getTracks().forEach((track) => track.stop());
        }
        webcamVideo.current.srcObject = null;
    };

    /**
     * Handles the click event of the webcam button
     * @returns {Promise<void>}
     */
    const startWebCam = async () => {
        // setting local stream to the video from our camera
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        // Pushing tracks from local stream to peerConnection
        localStream.getTracks().forEach((track) => {
            pc.addTrack(track, localStream);
        });

        // displaying the video data from the stream to the webpage
        webcamVideo.current.srcObject = localStream;

        // initializing the remote server to the media stream
        remoteStream = new MediaStream();

        remoteVideo.current.srcObject = remoteStream;

        pc.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                console.log("Adding track to remoteStream", track);
                remoteStream.addTrack(track);
            });
            remoteVideo.current.srcObject = remoteStream;
        };
    };

    /**
     * Handles the click event of the answer button
     * @returns {Promise<void>}
     */
    const answerCall = async () => {
        //TODO: If there is no incoming call, it will not be possible to answer the call

        const callId = currentUser.uid;
        // getting the data for this particular call
        const callDoc = doc(collection(db, "calls"), callId);
        const answerCandidates = collection(callDoc, "answerCandidates");
        const offerCandidates = collection(callDoc, "offerCandidates");

        // here we listen to the changes and add it to the answerCandidates
        pc.onicecandidate = (event) => {
            event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
        };

        const callData = (await getDoc(callDoc)).data();

        //Extract the offer from the caller.
        const offer = callData.offer;
        //Creat a RTCSessionDescription and set it as the remote description.
        await pc.setRemoteDescription(offer);

        // Create the answer
        const answerDescription = await pc.createAnswer();

        //Set the answer as the local description, and update the database.
        await pc.setLocalDescription(answerDescription);
        // answer config
        const answer = {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, {answer});

        //onSnapshot(offerCandidates, (snapshot) => {
        //    snapshot.docChanges().forEach((change) => {
        //        if (change.type === "added") {
        //            let candidate = new RTCIceCandidate(change.doc.data());
        //            pc.addIceCandidate(candidate);
        //        }
        //    });
        //});

        onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added") {
                    let data = change.doc.data();
                    pc.addIceCandidate(new RTCIceCandidate(data));
                    let candidate = new RTCIceCandidate();
                    candidatesQueue.push(candidate);
                }
            });

            if (pc.remoteDescription) {
                // Process all the candidates once the remote description is set
                candidatesQueue.forEach((candidate) => {
                    pc.addIceCandidate(candidate);
                });
                candidatesQueue = [];
            }
        });
        setJoinedCall(true);
    };

    /**
     * Hang up the video call
     */
    const hangupCall = () => {
        //TODO: complete this function
        setJoinedCall(false);
    };

    return (
        <Box
            sx={{
                height: "100%",
                width: "100%",
                maxHeight: "100%",
                maxWidth: "100%",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
            }}
        >
            <Grid
                container
                rowSpacing={1}
                columnSpacing={1}
                sx={{
                    height: "100%",
                    maxHeight: "100%",
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    right: 0,
                }}
            >
                <Grid item xs={12} sm={12} md={6} lg={6} sx={{textAlign: "center"}}>
                    <VideoContainer>
                        <VideoItem
                            component={"video"}
                            sx={{
                                transform: "scale(-1, 1)",
                            }}
                            id="webcamVideo"
                            autoPlay
                            playsInline
                            ref={webcamVideo}
                        ></VideoItem>
                    </VideoContainer>
                </Grid>
                <Grid item xs={12} sm={12} md={6} lg={6} sx={{textAlign: "center"}}>
                    <VideoContainer>
                        <VideoItem
                            component={"video"}
                            id="remoteVideo"
                            autoPlay
                            playsInline
                            ref={remoteVideo}
                        ></VideoItem>
                    </VideoContainer>
                </Grid>
            </Grid>

            <Stack
                spacing={3}
                sx={{position: "absolute", bottom: 0, right: 0, padding: "1rem"}}
            >
                {/*TODO: Add camera on or of button*/}
                <JoinButton
                    id="hangupButton"
                    bgcolor={joinedCall ? "#FF0000" : "#00FF00"}
                    hovercolor={joinedCall ? "#930000" : "#009900"}
                    onClick={joinedCall ? hangupCall : answerCall}
                    variant="contained"
                >
                    {joinedCall ? "X" : "JOIN"}
                </JoinButton>
            </Stack>

            <Box sx={{position: "fixed", top: 0, right: 0}}>
                <DropdownMenu handlePreSignOut={stopWebCam}/>
            </Box>
        </Box>
    );
}

export default VideoCallPage;
