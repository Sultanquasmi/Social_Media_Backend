import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/Cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findOne(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  // get user details from frontend

  const { username, fullname, email, password } = req.body;
  //  console.log("email:" , email)
  // validation - empty

  /* if(username === ""){
       throw new ApiError (400 , "Field is required")
     } */

  if (
    [username, fullname, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "Field is required");
  }

  // check if user already exists: username, email

  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    throw new ApiError(409, "User aleady exist");
  }

  // check for images , check for avatar

  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log(avatarLocalPath);
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

  // let coverImageLocalPath;
  // if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
  //     coverImageLocalPath = req.files.coverImage[0].path
  // }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is mandatory");
  }

  // upload them on cloudinary

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  console.log(avatar, "avatar");
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  //  if (!avatar) {
  //     throw new ApiError(400 , "Avatar file is required")
  //  }
  // create user object - create entry in db

  const user = await User.create({
    fullname,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  // remove password and refresh token field from response

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while creating user");
  }
  // return res

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req.body = data
  // username || email
  // user existed or not
  // password check
  // access token and refresh token
  // res

  const { username, email, password } = req.body;

  if (!(username || email)) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

   const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

   const options = {
    httpOnly : true ,
    secure : true
   }

   return res
   .status(200)
   .cookie("accessToken",accessToken, options)
   .cookie("refreshToken" , refreshToken, options)
   .json(
    new ApiResponse(200 , {
      user: loggedInUser, accessToken, refreshToken
    },
    "User logged in successfully"
    )
   )
});

const logoutUser = asyncHandler(async(req , res)=>{
       await User.findByIdAndUpdate(req.user._id,
        {
          $set:{
            refreshToken: undefined
          }
        },
        {
          new:true
        }
        )

        const options = {
          httpOnly : true ,
          secure : true
         }

         return res
         .status(200)
         .clearCookie(accessToken, options)
         .clearCookie(refreshToken, options)
         .json(new ApiResponse(200, {} , "User susseccfully loggedout"))

})

export { registerUser, 
  loginUser,
  logoutUser
};
