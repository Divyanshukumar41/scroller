export function errorHandler(err,req,res,next) {
  console.error(err);
  res.status(err.status || 500).json({success:false,message:process.env.NODE_ENV==="production"?"Something went wrong":err.message});
}